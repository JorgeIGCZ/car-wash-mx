import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { evidenceResponse } from "@/lib/evidence/http";
import { EvidenceError } from "@/lib/evidence/service";
import { cleanupEvidence } from "@/lib/evidence/cleanup";

export async function POST(request: Request) {
  return evidenceResponse(async () => {
    const secret = process.env.EVIDENCE_CLEANUP_SECRET;
    const supplied = request.headers.get("authorization") ?? "";
    const digest = (value: string) => createHash("sha256").update(value).digest();
    const scheduled = Boolean(secret && secret.length >= 32 && timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`)));
    if (!scheduled && (await getCurrentUser())?.role !== "ADMIN") throw new EvidenceError(403, "Acceso restringido.");
    const owner = randomUUID(), now = new Date();
    await prisma.evidenceWorkerState.upsert({ where: { id: "cleanup" }, create: { id: "cleanup", owner, leaseUntil: now, heartbeatAt: now }, update: {} });
    const claim = await prisma.evidenceWorkerState.updateMany({ where: { id: "cleanup", leaseUntil: { lte: now } }, data: { owner, heartbeatAt: now, leaseUntil: new Date(Date.now() + 5 * 60000) } });
    if (!claim.count) throw new EvidenceError(409, "Ya hay una limpieza en curso.");
    try { return { failures: await cleanupEvidence(owner, now, "cleanup") }; }
    finally { await prisma.evidenceWorkerState.updateMany({ where: { id: "cleanup", owner }, data: { leaseUntil: new Date(0) } }); }
  });
}
