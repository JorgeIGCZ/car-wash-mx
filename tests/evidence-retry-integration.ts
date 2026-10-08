import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { beginUpload } from "../src/lib/evidence/service";

async function main() {
  const database = new URL(process.env.DATABASE_URL || "");
  if (process.env.APP_ENV !== "local" || database.hostname !== "127.0.0.1" || database.pathname !== "/turbo_evidence_test" || new URL(process.env.R2_TEST_ENDPOINT || "").hostname !== "127.0.0.1") throw new Error("Requires disposable local database and fake storage");
  const suffix = randomUUID();
  const user = await prisma.user.create({ data: { name: "Retry test", email: `retry-${suffix}@example.test`, role: "ADMIN", passwordHash: "not-a-login-hash" } });
  const vehicle = await prisma.vehicleType.create({ data: { name: "Retry test", slug: `retry-${suffix}` } });
  const pack = await prisma.servicePackage.create({ data: { name: "Retry test", slug: `retry-${suffix}`, category: "INTERIOR" } });
  const wash = await prisma.wash.create({ data: { createdById: user.id, vehicleTypeId: vehicle.id, packageId: pack.id, chargedPrice: 1, evidenceRequired: true } });
  const draft = { zone: "INTERIOR", requestKey: randomUUID(), contentType: "video/mp4", byteSize: 100, note: "Original" };
  const first = await beginUpload(wash.id, user, draft);
  const retry = await beginUpload(wash.id, user, { ...draft, note: "Corrected after interruption" });
  assert.equal(first.id, retry.id);
  assert.equal(await prisma.evidenceVideo.count({ where: { washId: wash.id } }), 1);
  assert.equal((await prisma.evidenceVideo.findUniqueOrThrow({ where: { id: first.id } })).note, "Corrected after interruption");
  await assert.rejects(beginUpload(wash.id, user, { ...draft, byteSize: 200 }));
  await assert.rejects(beginUpload(wash.id, user, { ...draft, zone: "EXTERIOR" }));
  await assert.rejects(beginUpload(wash.id, user, { ...draft, contentType: "video/webm" }));
  await prisma.evidenceVideo.update({ where: { id: first.id }, data: { status: "QUEUED" } });
  await beginUpload(wash.id, user, { ...draft, note: "Must not overwrite queued evidence" });
  assert.equal((await prisma.evidenceVideo.findUniqueOrThrow({ where: { id: first.id } })).note, "Corrected after interruption");
  console.log("7 retry integration checks passed");
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
