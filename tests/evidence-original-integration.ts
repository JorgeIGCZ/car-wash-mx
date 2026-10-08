import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { EVIDENCE_RETENTION_MS } from "../src/lib/evidence/constants";

const base = process.env.EVIDENCE_TEST_ORIGIN || "http://127.0.0.1:3014";
const fixtures = process.env.EVIDENCE_TEST_FIXTURE_DIR || "/private/tmp/evidence-integration";
let checks = 0;
function check(condition: unknown, message: string) { assert.ok(condition, message); checks++; }
async function request(cookie: string, path: string, body?: unknown) {
  const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: { Cookie: cookie, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json(), headers: response.headers };
}
async function main() {
  const database = new URL(process.env.DATABASE_URL || "");
  if (process.env.APP_ENV !== "local" || database.hostname !== "127.0.0.1" || database.pathname !== "/turbo_evidence_test" || new URL(process.env.R2_TEST_ENDPOINT || "").hostname !== "127.0.0.1" || !base.startsWith("http://127.0.0.1:")) throw new Error("Requires disposable local database and storage");
  const suffix = randomUUID();
  const users: Awaited<ReturnType<typeof prisma.user.create>>[] = [], cookies: string[] = [];
  for (const role of ["ADMIN", "ADMINISTRATIVE", "EMPLOYEE", "COLLABORATOR"] as const) {
    const user = await prisma.user.create({ data: { name: `Original ${role}`, email: `original-${role}-${suffix}@example.test`, role, passwordHash: await hash("OriginalTestOnly!", 10), mustChangePassword: false } });
    const login = await request("", "/api/auth/login", { email: user.email, password: "OriginalTestOnly!" });
    check(login.status === 200, `${role} login`); users.push(user); cookies.push(login.headers.get("set-cookie")!.split(";")[0]);
  }
  const vehicle = await prisma.vehicleType.create({ data: { name: "Original test", slug: `original-${suffix}` } });
  const pack = await prisma.servicePackage.create({ data: { name: "Original test", slug: `original-${suffix}`, category: "INTERIOR" } });
  const wash = await prisma.wash.create({ data: { createdById: users[3].id, vehicleTypeId: vehicle.id, packageId: pack.id, chargedPrice: 1, evidenceRequired: true } });
  const api = `/api/washes/${wash.id}/evidence`;
  const mp4 = await readFile(`${fixtures}/landscape.mp4`);
  async function start(zone: string, file: Buffer, type = "video/mp4", cookie = cookies[3]) {
    return request(cookie, api, { zone, requestKey: randomUUID(), contentType: type, byteSize: file.length, note: "Client note" });
  }
  check((await start("INTERIOR", mp4, "video/mp4", cookies[2])).status === 404, "Other employee denied");
  const first = await start("INTERIOR", mp4);
  check(first.status === 200, "Owner starts upload");
  await fetch(first.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: mp4 });
  const [a, b] = await Promise.all([request(cookies[3], `${api}/${first.body.id}/complete`, {}), request(cookies[3], `${api}/${first.body.id}/complete`, {})]);
  check(a.body.status === "READY" && b.body.status === "READY", "Concurrent confirmations ready immediately");
  check(await prisma.evidenceEvent.count({ where: { videoId: first.body.id, action: "ORIGINAL_VIDEO_ACCEPTED" } }) === 1, "One acceptance event");
  const saved = await prisma.evidenceVideo.findUniqueOrThrow({ where: { id: first.body.id } });
  check(saved.expiresAt!.getTime() - saved.uploadedAt!.getTime() === EVIDENCE_RETENTION_MS, "Expiry from initial upload");
  check(saved.byteSize === mp4.length && saved.durationSeconds === 2, "Actual size and duration verified");
  const playback = await request(cookies[3], `${api}/${first.body.id}/play`);
  const playable = await fetch(playback.body.url);
  check(Buffer.from(await playable.arrayBuffer()).equals(mp4), "Playback bytes unchanged");
  const long = await readFile(`${fixtures}/long.mp4`);
  await fetch(first.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: long });
  check(Buffer.from(await (await fetch(playback.body.url)).arrayBuffer()).equals(mp4), "Original PUT cannot overwrite accepted video");
  check((await request(cookies[3], `${api}/share`, { action: "create" })).status === 409, "Share requires both videos");
  const webm = await readFile(`${fixtures}/browser.webm`);
  const second = await start("EXTERIOR", webm, "video/webm", cookies[1]);
  await fetch(second.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/webm" }, body: webm });
  // Simulate a previously queued upload: recovery must not reset retention.
  const uploadedAt = new Date(), expiresAt = new Date(uploadedAt.getTime() + EVIDENCE_RETENTION_MS);
  await prisma.evidenceVideo.update({ where: { id: second.body.id }, data: { status: "QUEUED", uploadedAt, expiresAt } });
  check((await request(cookies[0], `${api}/${second.body.id}/complete`, {})).body.status === "READY", "Queued WebM verified without worker");
  check((await prisma.evidenceVideo.findUniqueOrThrow({ where: { id: second.body.id } })).expiresAt!.getTime() === expiresAt.getTime(), "Recovery preserves expiry");
  const webmPlay = await request(cookies[0], `${api}/${second.body.id}/play`);
  check(new URL(webmPlay.body.url).searchParams.get("response-content-type") === "video/webm", "Native MIME preserved");
  check(Buffer.from(await (await fetch(webmPlay.body.url)).arrayBuffer()).equals(webm), "WebM unchanged");
  check((await request(cookies[3], `${api}/share`, { action: "create" })).status === 200, "Owner shares ready evidence");
  check((await request(cookies[2], "/api/admin/evidence-cleanup", {})).status === 403, "Cleanup restricted");
  for (const [name, file] of [["long", long], ["silent", await readFile(`${fixtures}/silent.mp4`)], ["fake", Buffer.from("fake video")]] as const) {
    const invalid = await start("INTERIOR", file, "video/mp4", cookies[0]);
    await fetch(invalid.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: file });
    check((await request(cookies[0], `${api}/${invalid.body.id}/complete`, {})).status === 400, `${name} rejected`);
    check((await prisma.evidenceVideo.findUniqueOrThrow({ where: { id: invalid.body.id } })).status === "FAILED", `${name} recorded failed`);
  }
  await prisma.evidenceVideo.update({ where: { id: second.body.id }, data: { expiresAt: new Date(Date.now() - 1), uploadExpiresAt: new Date(Date.now() - 120000) } });
  check((await request(cookies[0], `${api}/${second.body.id}/play`)).status === 410, "Expired access denied before cleanup");
  const cleanup = await request(cookies[0], "/api/admin/evidence-cleanup", {});
  check(cleanup.status === 200 && cleanup.body.failures === 0, "Cleanup without FFmpeg");
  check(Boolean((await prisma.evidenceVideo.findUniqueOrThrow({ where: { id: second.body.id } })).deletedAt), "Expired files deletion recorded");
  check((await request(cookies[0], "/api/admin/evidence-status")).body.healthy, "Cleanup health tracked");
  console.log(`${checks} original-video integration checks passed`);
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error instanceof assert.AssertionError ? error.message : "Original video integration failed"); process.exitCode = 1; });
