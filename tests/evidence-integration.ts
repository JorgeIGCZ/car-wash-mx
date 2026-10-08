import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { acquireLease, cleanupEvidence, processOne, recoverJobs } from "../src/lib/evidence/worker";
import { evidenceEnabled } from "../src/lib/evidence/service";
import { EVIDENCE_RETENTION_MS } from "../src/lib/evidence/constants";

const exec = promisify(execFile);
const base = process.env.EVIDENCE_TEST_ORIGIN || "http://127.0.0.1:3012";
const fixtureDir = process.env.EVIDENCE_TEST_FIXTURE_DIR || "/private/tmp/evidence-integration";
const fakeStorage = process.env.R2_TEST_ENDPOINT || "http://127.0.0.1:3013";
let checks = 0;
let testWorker: string | null = null;
function check(condition: unknown, message: string) { assert.ok(condition, message); checks++; }
async function request(cookie: string, path: string, method = "GET", body?: unknown) {
  const response = await fetch(base + path, {method, redirect:"manual", headers: { Cookie:cookie, ...(body !== undefined ? {"Content-Type":"application/json"} : {}) }, body: body === undefined ? undefined : JSON.stringify(body)});
  const text = await response.text();
  let result; try { result = JSON.parse(text); } catch { result = null; }
  return {status:response.status, body:result, text, headers:response.headers};
}
async function main() {
  const database = new URL(process.env.DATABASE_URL || "");
  if (process.env.APP_ENV !== "local" || database.hostname !== "127.0.0.1" || database.pathname !== "/turbo_evidence_test" || !base.startsWith("http://127.0.0.1:") || !process.env.R2_TEST_ENDPOINT || new URL(fakeStorage).hostname !== "127.0.0.1" || new URL(fakeStorage).protocol !== "http:") throw new Error("Integration tests require the isolated local database and fake storage");
  await mkdir(fixtureDir,{recursive:true});
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  for (const [name, width, height, duration, audio] of [["landscape",1280,720,2,true],["portrait",720,1280,2,true],["long",160,120,46,true],["silent",160,120,2,false]] as const) {
    await exec(ffmpeg,["-hide_banner","-loglevel","error","-f","lavfi","-i",`color=c=blue:s=${width}x${height}:r=24`, ...(audio ? ["-f","lavfi","-i","sine=frequency=440:sample_rate=44100"] : []),"-t",String(duration),"-c:v","libx264","-threads","1","-pix_fmt","yuv420p",...(audio ? ["-c:a","aac"] : []),"-y",`${fixtureDir}/${name}.mp4`],{timeout:60000});
  }
  await exec(ffmpeg,["-hide_banner","-loglevel","error","-f","lavfi","-i","color=c=blue:s=320x240:r=24","-f","lavfi","-i","sine=frequency=440:sample_rate=48000","-t","2","-c:v","libvpx","-threads","1","-c:a","libopus","-live","1","-y",`${fixtureDir}/browser.webm`],{timeout:60000});
  const content = await readFile(`${fixtureDir}/landscape.mp4`);
  const runId = randomUUID().slice(0,8);
  const users = {} as Record<string, Awaited<ReturnType<typeof prisma.user.create>>>;
  const cookies = {} as Record<string,string>;
  const password = "LocalEvidenceTest2026!";
  for (const role of ["ADMIN","ADMINISTRATIVE","EMPLOYEE","COLLABORATOR"] as const) {
    users[role] = await prisma.user.create({data:{name:`Prueba ${role}`,email:`${role.toLowerCase()}-${runId}@example.test`,role,passwordHash:await hash(password,10),mustChangePassword:false}});
    const login = await request("","/api/auth/login","POST",{email:users[role].email,password});
    check(login.status===200,`${role}: login`); cookies[role]=login.headers.get("set-cookie")!.split(";")[0];
  }
  const vehicle = await prisma.vehicleType.create({data:{name:"Sedán evidencia",slug:`evidence-${runId}`}});
  const pack = await prisma.servicePackage.create({data:{name:"Lavado de interiores",category:"INTERIOR",slug:`evidence-${runId}`}});
  await prisma.servicePrice.create({data:{vehicleTypeId:vehicle.id,packageId:pack.id,amount:300}});
  const payload = {vehicleTypeId:vehicle.id,packageId:pack.id,notes:"SECRET_INTERNAL_NOTE",plate:"TEST"};
  const legacy = await prisma.wash.create({data:{vehicleTypeId:vehicle.id,packageId:pack.id,createdById:users.EMPLOYEE.id,chargedPrice:100}});
  check(!legacy.evidenceRequired,"Migration default does not require evidence for old records");
  check((await request(cookies.ADMIN,`/api/washes/${legacy.id}/evidence`)).status===404,"Old records do not show evidence");
  const created = await request(cookies.COLLABORATOR,"/api/washes","POST",payload);
  check(created.status===201 && created.body.evidenceRequired,"New interior service requires evidence");
  const washId = created.body.id as number;
  const apiBase = `/api/washes/${washId}/evidence`;
  const draft = {zone:"INTERIOR",requestKey:randomUUID(),contentType:"video/mp4",byteSize:content.length,note:"Mancha previa de prueba"};
  check((await request("",apiBase)).status===401,"Anonymous internal access denied");
  check((await request(cookies.EMPLOYEE,apiBase,"POST",draft)).status===404,"Unrelated employee cannot upload");
  await prisma.washParticipant.create({data:{washId,userId:users.EMPLOYEE.id}});
  check((await request(cookies.EMPLOYEE,apiBase)).status===200,"Participant can consult");
  check((await request(cookies.EMPLOYEE,apiBase,"POST",draft)).status===404,"Participant cannot upload for someone else");
  check((await request(cookies.ADMIN,apiBase,"POST",{...draft,byteSize:26*1024*1024})).status===400,"Oversize declared upload rejected");
  check((await request(cookies.COLLABORATOR,`${apiBase}/share`,"POST",{action:"create"})).status===409,"Incomplete evidence cannot be shared");
  const [a,b] = await Promise.all([request(cookies.COLLABORATOR,apiBase,"POST",draft),request(cookies.COLLABORATOR,apiBase,"POST",draft)]);
  check(a.status===200 && b.status===200 && a.body.id===b.body.id,"Concurrent retries return the same upload");
  check(await prisma.evidenceVideo.count({where:{washId}})===1,"No duplicate video record");
  check(new URL(a.body.uploadUrl).searchParams.get("X-Amz-SignedHeaders")?.includes("content-length"),"Upload authorization binds the expected size");
  const interrupted = await request(cookies.COLLABORATOR,`${apiBase}/${a.body.id}/complete`,"POST",{});
  check(interrupted.status===409,"Missing object remains retryable");
  check((await fetch(a.body.uploadUrl,{method:"PUT",headers:{"Content-Type":"video/mp4"},body:content})).ok,"Direct upload to isolated S3");
  const confirmed = await request(cookies.COLLABORATOR,`${apiBase}/${a.body.id}/complete`,"POST",{});
  check(confirmed.status===200 && confirmed.body.status==="QUEUED","Upload queued");
  check((await request(cookies.COLLABORATOR,`${apiBase}/${a.body.id}/complete`,"POST",{})).status===200,"Complete is idempotent");
  const queued = await prisma.evidenceVideo.findUniqueOrThrow({where:{id:a.body.id}});
  check(queued.expiresAt!.getTime()-queued.uploadedAt!.getTime()===EVIDENCE_RETENTION_MS,"Retention starts from original upload");
  const worker = `test-${runId}`;
  check(await acquireLease(worker),"Worker lease acquired");
  testWorker = worker;
  check(!await acquireLease(`other-${runId}`),"Second worker cannot process simultaneously");
  await processOne(worker);
  let processed = await prisma.evidenceVideo.findUniqueOrThrow({where:{id:a.body.id}});
  check(processed.status==="READY",`Real FFmpeg conversion: ${processed.status} ${processed.errorCode}`);
  check(processed.width===1280 && processed.height===720 && processed.durationSeconds! <=45,"Normalized landscape and duration");
  check((await request(cookies.COLLABORATOR,apiBase,"POST",{...draft,requestKey:randomUUID()})).status===403,"Collaborator cannot replace accepted evidence");
  check((await request(cookies.ADMINISTRATIVE,apiBase,"POST",{...draft,requestKey:randomUUID()})).status===403,"Administrative cannot replace accepted evidence");
  async function uploadFile(wash: number, zone: string, bytes: Buffer, role="ADMIN", note="Exterior de prueba") {
    const start = await request(cookies[role],`/api/washes/${wash}/evidence`,"POST",{zone,requestKey:randomUUID(),contentType:"video/mp4",byteSize:bytes.length,note});
    check(start.status===200,`Start ${zone}: ${start.text}`);
    check((await fetch(start.body.uploadUrl,{method:"PUT",headers:{"Content-Type":"video/mp4"},body:new Uint8Array(bytes)})).ok,"Upload accepted");
    const complete = await request(cookies[role],`/api/washes/${wash}/evidence/${start.body.id}/complete`,"POST",{});
    check(complete.status===200,"Complete accepted"); return start.body.id as string;
  }
  const exterior = await uploadFile(washId,"EXTERIOR",await readFile(`${fixtureDir}/portrait.mp4`),"ADMINISTRATIVE");
  // Simulate a process that died after claiming a job, then recover it with the lease holder.
  await prisma.evidenceVideo.update({where:{id:exterior},data:{status:"PROCESSING",processingOwner:"dead-worker"}});
  await recoverJobs(worker); await processOne(worker);
  processed = await prisma.evidenceVideo.findUniqueOrThrow({where:{id:exterior}});
  check(processed.status==="READY" && processed.width===720 && processed.height===1280,"Restart recovery and portrait preservation");
  check((await request(cookies.COLLABORATOR,`${apiBase}/share`,"POST",{action:"create"})).status===200,"Owner can generate link when complete");
  let view = await request(cookies.COLLABORATOR,apiBase);
  const path = view.body.sharePath as string;
  check(path.startsWith("/evidencia/") && path.split("/").pop()!.length===64,"Opaque public token");
  const publicPage = await request("",path);
  check(publicPage.status===200 && publicPage.text.includes("Mancha previa de prueba"),"Public page renders intended observations");
  for (const secret of ["SECRET_INTERNAL_NOTE",users.COLLABORATOR.email,users.COLLABORATOR.name,"chargedPrice","personalCommission"]) check(!publicPage.text.includes(secret),`Public response excludes ${secret}`);
  check(publicPage.headers.get("cache-control")?.includes("no-store") && publicPage.headers.get("x-robots-tag")?.includes("noindex"),"Public page not cached or indexed");
  const token = path.split("/").pop();
  const play = await request("",`/api/evidence/${token}/${a.body.id}/play`);
  check(play.status===200 && new URL(play.body.url).searchParams.get("X-Amz-Expires")==="60","Public playback uses brief signed access");
  const range = await fetch(play.body.url,{headers:{Range:"bytes=0-99"}});
  check(range.status===206 && (await range.arrayBuffer()).byteLength===100,"Video byte ranges work");
  check((await request("",`/api/evidence/${token}/unknown/play`)).status===404,"Token cannot access another video");
  const history = await request(cookies.ADMIN,"/api/washes?scope=all");
  check(!history.text.includes(token!) && !history.text.includes("evidence/originals/"),"History does not expose share tokens or storage keys");
  check((await request(cookies.ADMINISTRATIVE,`${apiBase}/share`,"POST",{action:"revoke"})).status===403,"Only admin can revoke");
  await request(cookies.ADMIN,`${apiBase}/share`,"POST",{action:"revoke"});
  check((await request("",`/api/evidence/${token}/${a.body.id}/play`)).status===404,"Revoked link stops issuing video access");
  check((await request(cookies.COLLABORATOR,`${apiBase}/share`,"POST",{action:"create"})).status===403,"Owner cannot undo revocation");
  await request(cookies.ADMIN,`${apiBase}/share`,"POST",{action:"rotate"});
  view = await request(cookies.ADMIN,apiBase);
  check(view.body.sharePath!==path,"Rotation uses a different link");
  // Editing service dates must not extend retention.
  await request(cookies.ADMIN,`/api/washes/${washId}`,"PATCH",{serviceDate:"2026-01-01"});
  check((await prisma.evidenceVideo.findUniqueOrThrow({where:{id:a.body.id}})).expiresAt!.getTime()===queued.expiresAt!.getTime(),"Changing service date preserves retention");
  for (const name of ["long","silent","corrupt"] as const) {
    const target = await request(cookies.EMPLOYEE,"/api/washes","POST",payload);
    const id = await uploadFile(target.body.id,"INTERIOR",name==="corrupt" ? Buffer.from("not a video") : await readFile(`${fixtureDir}/${name}.mp4`),"EMPLOYEE");
    await processOne(worker);
    const invalid = await prisma.evidenceVideo.findUniqueOrThrow({where:{id}});
    check(invalid.status==="FAILED" && invalid.errorCode==="INVALID_VIDEO",`${name} file rejected by server`);
  }
  const webmWash = await request(cookies.EMPLOYEE,"/api/washes","POST",payload);
  const webm = await uploadFile(webmWash.body.id,"INTERIOR",await readFile(`${fixtureDir}/browser.webm`),"EMPLOYEE");
  await processOne(worker);
  check((await prisma.evidenceVideo.findUniqueOrThrow({where:{id:webm}})).status==="READY","Browser WebM without container duration is validated and normalized");
  const replacement = await uploadFile(washId,"INTERIOR",content);
  await processOne(worker);
  check((await prisma.evidenceVideo.findUniqueOrThrow({where:{id:a.body.id}})).status==="SUPERSEDED","Admin replacement keeps old audit record");
  check(await prisma.evidenceEvent.count({where:{washId,action:"UPLOAD_REPLACEMENT"}})===1,"Replacement audit event saved");
  // Expire without cleanup, then test deletion failure/retry with a controlled clock.
  await prisma.evidenceVideo.update({where:{id:replacement},data:{expiresAt:new Date(Date.now()-1000)}});
  const currentToken = view.body.sharePath.split("/").pop();
  check((await request("",`/api/evidence/${currentToken}/${replacement}/play`)).status===410,"Expired video denied before physical deletion");
  check((await request(cookies.ADMIN,`/api/washes/${washId}`,"DELETE")).status===204,"Admin can delete service with evidence");
  const deletedPage = await request("",view.body.sharePath);
  check(deletedPage.text.includes("Este enlace ya no está disponible") && !deletedPage.text.includes("Mancha previa de prueba"),"Deleted service disables public page");
  check((await request("",`/api/evidence/${currentToken}/${exterior}/play`)).status===404,"Deleted service disables otherwise valid video access");
  const future = new Date(Date.now()+11*86400000);
  await fetch(`${fakeStorage}/_test/fail-deletes`,{method:"POST"});
  check(await cleanupEvidence(worker,future)>0,"Storage deletion failure is recorded");
  check((await prisma.evidenceVideo.findUniqueOrThrow({where:{id:replacement}})).deletedAt===null,"Failed deletion remains pending");
  await fetch(`${fakeStorage}/_test/fail-deletes`,{method:"DELETE"});
  check(await cleanupEvidence(worker,future)===0,"Deletion retries succeed");
  check(Boolean((await prisma.evidenceVideo.findUniqueOrThrow({where:{id:replacement}})).deletedAt),"Successful cleanup retains metadata");
  check(await prisma.evidenceEvent.count({where:{washId,action:"FILES_DELETED"}})>0,"Deletion audit retained");
  check((await request(cookies.COLLABORATOR,"/api/admin/evidence-status")).status===403,"Worker diagnostics are admin-only");
  check((await request(cookies.ADMIN,"/api/admin/evidence-status")).status===200,"Admin diagnostics available");
  const originalFlag = process.env.EVIDENCE_ENABLED; process.env.EVIDENCE_ENABLED="false"; check(!evidenceEnabled(),"Feature flag disables capture"); process.env.EVIDENCE_ENABLED=originalFlag;
  await prisma.evidenceWorkerState.updateMany({where:{owner:worker},data:{leaseUntil:new Date(0)}});
  await writeFile(`${fixtureDir}/ui-fixture.json`,JSON.stringify({admin:users.ADMIN.email,collaborator:users.COLLABORATOR.email,password,vehicleId:vehicle.id,packageId:pack.id}));
  console.log(`${checks} integration checks passed: auth, uploads, FFmpeg, sharing, expiry, cleanup and recovery.`);
}
main().catch(error=>{console.error(error instanceof Error ? error.message : "Integration failed");process.exitCode=1}).finally(async()=>{ if (testWorker) await prisma.evidenceWorkerState.updateMany({where:{owner:testWorker},data:{leaseUntil:new Date(0)}}); await prisma.$disconnect(); });
