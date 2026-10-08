import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { hash } from "bcryptjs";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";
import { EVIDENCE_RETENTION_MS } from "../src/lib/evidence/constants";

const origin = process.env.EVIDENCE_TEST_ORIGIN || "http://127.0.0.1:3014";
let checks = 0;
function check(value: unknown, label: string) { assert.ok(value, label); checks++; }
async function request(cookie: string, path: string, method = "GET", body?: unknown) {
  const response = await fetch(origin + path, { method, headers: { Cookie: cookie, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text(); let json; try { json = JSON.parse(text); } catch { json = null; }
  return { response, text, json };
}
async function main() {
  const db = new URL(process.env.DATABASE_URL || "");
  const storage = new URL(process.env.R2_TEST_ENDPOINT || "");
  if (process.env.APP_ENV !== "local" || db.hostname !== "127.0.0.1" || db.pathname !== "/turbo_evidence_test" || storage.hostname !== "127.0.0.1" || !origin.startsWith("http://127.0.0.1:")) throw new Error("Disposable local fixtures required");
  const run = randomUUID().slice(0, 8); const password = "LocalEvidenceTest2026!";
  const users = {} as Record<string, Awaited<ReturnType<typeof prisma.user.create>>>;
  const cookies = {} as Record<string, string>;
  for (const role of ["ADMIN", "ADMINISTRATIVE", "EMPLOYEE", "COLLABORATOR"] as const) {
    users[role] = await prisma.user.create({ data: { role, name: `Fotos ${role}`, email: `photos-${role.toLowerCase()}-${run}@example.test`, passwordHash: await hash(password, 10), mustChangePassword: false } });
    const login = await request("", "/api/auth/login", "POST", { email: users[role].email, password });
    check(login.response.status === 200, `${role} login`); cookies[role] = login.response.headers.get("set-cookie")!.split(";")[0];
  }
  const vehicle = await prisma.vehicleType.create({ data: { name: "Sedán de prueba", slug: `photos-${run}` } });
  const pack = await prisma.servicePackage.create({ data: { name: "Lavado de interiores", category: "INTERIOR", slug: `photos-${run}` } });
  const token = randomBytes(32).toString("hex");
  const wash = await prisma.wash.create({ data: { vehicleTypeId: vehicle.id, packageId: pack.id, createdById: users.COLLABORATOR.id, chargedPrice: 300, evidenceRequired: true, evidenceToken: token, notes: "INTERNAL_SECRET" } });
  const secondWash = await prisma.wash.create({ data: { vehicleTypeId: vehicle.id, packageId: pack.id, createdById: users.EMPLOYEE.id, chargedPrice: 100, evidenceRequired: true } });
  const bytes = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#dbc06a" } }).webp().toBuffer();
  async function addPhoto(washId: number, age = 0) {
    const key = `washes/${washId}/${randomUUID()}.webp`;
    check((await fetch(`${storage.origin}/${process.env.R2_BUCKET_NAME}/${key}`, { method: "PUT", body: new Uint8Array(bytes), headers: { "Content-Type": "image/webp" } })).ok, "Store photo fixture");
    return prisma.washPhoto.create({ data: { washId, objectKey: key, mimeType: "image/webp", byteSize: bytes.length, width: 600, height: 400, createdAt: new Date(Date.now() - age) } });
  }
  const photo = await addPhoto(wash.id); const other = await addPhoto(secondWash.id); const expired = await addPhoto(wash.id, EVIDENCE_RETENTION_MS + 1000);
  const base = `/api/washes/${wash.id}/evidence`; const endpoint = `${base}/photos/${photo.id}`;
  const publicPath = `/evidencia/${token}`; const imagePath = `/api/evidence/${token}/photos/${photo.id}`;
  const visible = { clientVisible: true, clientNote: "Raspón previo en puerta derecha" };
  check(!photo.clientVisible && photo.clientNote === null, "Existing/new photos default private");
  check((await request("", endpoint)).response.status === 401, "Internal thumbnail needs session");
  check((await request("", endpoint, "PATCH", visible)).response.status === 401, "Anonymous cannot publish");
  check((await request(cookies.EMPLOYEE, endpoint, "PATCH", visible)).response.status === 404, "Unrelated employee cannot publish");
  await prisma.washParticipant.create({ data: { washId: wash.id, userId: users.EMPLOYEE.id } });
  check((await request(cookies.EMPLOYEE, endpoint)).response.status === 200, "History participant can read thumbnail");
  check((await request(cookies.EMPLOYEE, endpoint, "PATCH", visible)).response.status === 404, "Read access does not grant publication");
  check((await request(cookies.ADMIN, `${base}/photos/${other.id}`, "PATCH", visible)).response.status === 404, "Photo cannot be assigned across services");
  check((await request("", imagePath)).response.status === 404, "Unmarked public image denied");
  check(!(await request("", publicPath)).text.includes(imagePath), "Unmarked photo excluded from public HTML");
  check((await request(cookies.COLLABORATOR, endpoint, "PATCH", { ...visible, clientNote: "x".repeat(1001) })).response.status === 400, "Note length enforced");
  check((await request(cookies.COLLABORATOR, endpoint, "PATCH", { ...visible, objectKey: "wrong" })).response.status === 400, "Protected fields denied");
  check((await request(cookies.COLLABORATOR, endpoint, "PATCH", visible)).response.ok, "Owner collaborator can publish");
  check((await request(cookies.COLLABORATOR, endpoint, "PATCH", visible)).response.ok, "Publication idempotent");
  check(await prisma.evidenceEvent.count({ where: { washId: wash.id, action: `PHOTO_${photo.id}_SHARED` } }) === 1, "No duplicate audit event on retry");
  const saved = await prisma.washPhoto.findUniqueOrThrow({ where: { id: photo.id } });
  check(saved.createdAt.getTime() === photo.createdAt.getTime() && saved.objectKey === photo.objectKey, "Marking preserves upload time and stored original");
  const view = await request(cookies.ADMIN, base);
  check(new Date(view.json.photos.find((p: {id: number}) => p.id === photo.id).expiresAt).getTime() === photo.createdAt.getTime() + EVIDENCE_RETENTION_MS, "Expiry is ten days from original photo upload");
  const page = await request("", publicPath);
  check(page.text.includes(visible.clientNote) && page.text.includes(imagePath), "Marked photo and public note render");
  for (const secret of [photo.objectKey, "INTERNAL_SECRET", users.COLLABORATOR.name, users.COLLABORATOR.email]) check(!page.text.includes(secret), "Public page excludes private data");
  const image = await request("", imagePath);
  check(image.response.status === 200 && image.response.headers.get("content-type") === "image/webp", "Client can load selected photo");
  check(image.response.headers.get("cache-control")?.includes("no-store") && image.response.headers.get("x-robots-tag")?.includes("noindex"), "Public image no cache/index");
  check((await request(cookies.ADMINISTRATIVE, endpoint, "PATCH", { ...visible, clientVisible: false })).response.ok, "Administrative can unmark");
  check((await request("", imagePath)).response.status === 404, "Unmark immediately denies fresh image access");
  check((await request(cookies.ADMIN, endpoint, "PATCH", visible)).response.ok, "Administrator can publish again");
  check((await request(cookies.EMPLOYEE, `/api/washes/${secondWash.id}/evidence/photos/${other.id}`, "PATCH", visible)).response.ok, "Employee can publish owned service");
  check((await request(cookies.ADMIN, `${base}/photos/${expired.id}`, "PATCH", visible)).response.status === 410, "Expired photo cannot extend retention by marking");
  await prisma.washPhoto.update({ where: { id: expired.id }, data: { clientVisible: true } });
  check((await request("", `/api/evidence/${token}/photos/${expired.id}`)).response.status === 404, "Already-marked expired photo denied");
  check((await request(cookies.ADMIN, `${base}/photos/${expired.id}`)).response.ok, "Expired photo stays available internally");
  check((await request(cookies.ADMIN, `${base}/photos/${expired.id}`, "PATCH", { ...visible, clientVisible: false })).response.ok, "Expired photo can be unmarked");
  await prisma.wash.update({ where: { id: wash.id }, data: { createdAt: new Date("2025-01-01") } });
  check((await request("", imagePath)).response.ok, "Editable service date does not expire photo");
  await prisma.wash.update({ where: { id: wash.id }, data: { evidenceRevokedAt: new Date() } });
  check((await request("", imagePath)).response.status === 404, "Revocation denies public photo");
  await prisma.wash.update({ where: { id: wash.id }, data: { evidenceRevokedAt: null, evidenceToken: randomBytes(32).toString("hex") } });
  check((await request("", imagePath)).response.status === 404, "Rotation invalidates old photo link");
  // Leave an independent, safe fixture available for browser verification.
  await prisma.wash.update({ where: { id: wash.id }, data: { evidenceToken: token, createdAt: new Date() } });
  await writeFile("/private/tmp/evidence-photos-ui.json", JSON.stringify({ email: users.ADMIN.email, password, washId: wash.id, photoId: photo.id, publicPath }));
  await prisma.wash.update({ where: { id: secondWash.id }, data: { evidenceToken: randomBytes(32).toString("hex"), deletedAt: new Date() } });
  const deleted = await prisma.wash.findUniqueOrThrow({ where: { id: secondWash.id } });
  check((await request("", `/api/evidence/${deleted.evidenceToken}/photos/${other.id}`)).response.status === 404, "Deleted service blocks public photo");
  check((await request(cookies.ADMIN, `/api/washes/${secondWash.id}/evidence/photos/${other.id}`, "PATCH", visible)).response.status === 404, "Deleted service cannot publish");
  check((await fetch(`${storage.origin}/${process.env.R2_BUCKET_NAME}/${photo.objectKey}`)).ok, "Visibility changes never delete the original photo");
  console.log(`Photo evidence integration passed: ${checks} checks`);
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : "Photo evidence integration failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
