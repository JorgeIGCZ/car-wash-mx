import { prisma } from "@/lib/prisma";
import { evidenceResponse, evidenceUser } from "@/lib/evidence/http";
import { evidenceEnabled, EvidenceError } from "@/lib/evidence/service";
export async function GET() {
  return evidenceResponse(async () => {
    if ((await evidenceUser()).role !== "ADMIN") throw new EvidenceError(403, "Acceso restringido.");
    const [worker, pending, failed, oldest, expired] = await Promise.all([
      prisma.evidenceWorkerState.findUnique({ where: { id: "main" }, select: { heartbeatAt: true, lastCleanupAt: true, lastError: true } }),
      prisma.evidenceVideo.count({ where: { status: { in: ["QUEUED", "PROCESSING"] } } }),
      prisma.evidenceVideo.count({ where: { status: "FAILED", activeSlot: { not: null } } }),
      prisma.evidenceVideo.findFirst({ where: { status: { in: ["QUEUED", "PROCESSING"] } }, orderBy: { uploadedAt: "asc" }, select: { uploadedAt: true } }),
      prisma.evidenceVideo.count({ where: { expiresAt: { lte: new Date() }, deletedAt: null } }),
    ]);
    return { enabled: evidenceEnabled(), worker, healthy: Boolean(worker && Date.now() - worker.heartbeatAt.getTime() < 120000), pending, failed, expiredAwaitingDeletion: expired, oldestPendingAt: oldest?.uploadedAt ?? null };
  });
}
