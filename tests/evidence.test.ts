import test from "node:test";
import assert from "node:assert/strict";
import { evidenceStatus, videoStatus, EVIDENCE_RETENTION_MS } from "../src/lib/evidence/constants";
import { canUploadEvidence } from "../src/lib/evidence/service";
const now = Date.UTC(2026, 9, 3, 12);
const future = new Date(now + EVIDENCE_RETENTION_MS);
test("two ready zones are required to share; no missing upload counts as evidence", () => {
  assert.equal(evidenceStatus([], now), "PENDING");
  assert.equal(evidenceStatus([{status:"READY",expiresAt:future}], now), "PENDING");
  assert.equal(evidenceStatus([{status:"READY",expiresAt:future},{status:"READY",expiresAt:future}], now), "READY");
  assert.equal(evidenceStatus([{status:"QUEUED",expiresAt:future}], now), "PROCESSING");
  assert.equal(evidenceStatus([{status:"FAILED",expiresAt:future}], now), "PENDING");
});
test("expiry is enforced at read time even when cleanup has not run", () => {
  assert.equal(videoStatus({status:"READY",expiresAt:new Date(now)},now),"EXPIRED");
  assert.equal(videoStatus({status:"READY",expiresAt:new Date(now + 1)},now),"READY");
  assert.equal(evidenceStatus([{status:"READY",expiresAt:future},{status:"READY",expiresAt:new Date(now)}],now),"EXPIRED");
});
test("both worker roles can upload only for their own services", () => {
  for (const role of ["EMPLOYEE","COLLABORATOR"] as const) {
    assert.equal(canUploadEvidence({id:1,role},1),true);
    assert.equal(canUploadEvidence({id:1,role},2),false);
  }
  for (const role of ["ADMIN","ADMINISTRATIVE"] as const) assert.equal(canUploadEvidence({id:1,role},2),true);
});
