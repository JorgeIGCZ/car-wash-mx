import { prisma } from "../prisma";
import { removeVideoObject } from "./storage";

export async function cleanupEvidence(owner: string, now = new Date(), stateId = "main") {
  await prisma.evidenceVideo.updateMany({ where: { expiresAt: { lte: now }, status: { notIn: ["SUPERSEDED", "EXPIRED"] } }, data: { status: "EXPIRED" } });
  await prisma.evidenceVideo.updateMany({ where: { status: "UPLOADING", uploadExpiresAt: { lt: new Date(now.getTime() - 60000) } }, data: { status: "FAILED", errorCode: "UPLOAD_EXPIRED" } });
  const videos = await prisma.evidenceVideo.findMany({ where: {
    OR: [
      { originalDeletedAt: null, uploadExpiresAt: { lt: new Date(now.getTime() - 60000) }, status: { in: ["READY", "FAILED", "EXPIRED", "SUPERSEDED"] } },
      { deletedAt: null, OR: [{ status: { in: ["EXPIRED", "SUPERSEDED", "FAILED"] } }, { wash: { deletedAt: { not: null } } }] },
    ],
  }, take: 100, orderBy: { createdAt: "asc" } });
  let failures = 0;
  for (const video of videos) {
    try {
      const wash = await prisma.wash.findUnique({ where: { id: video.washId }, select: { deletedAt: true } });
      const removeAll = Boolean(wash?.deletedAt) || ["EXPIRED", "SUPERSEDED", "FAILED"].includes(video.status);
      if (video.uploadExpiresAt.getTime() + 60000 > now.getTime()) continue;
      if (!video.originalDeletedAt) {
        await removeVideoObject(video.originalKey);
        await prisma.evidenceVideo.update({ where: { id: video.id }, data: { originalDeletedAt: now } });
      }
      if (removeAll) {
        if (video.processedKey && !video.processedDeletedAt) await removeVideoObject(video.processedKey);
        await prisma.evidenceVideo.update({ where: { id: video.id }, data: { processedDeletedAt: now, deletedAt: now,
          ...(wash?.deletedAt ? { status: "EXPIRED" } : {}) } });
        if (!video.deletedAt) await prisma.evidenceEvent.create({ data: { washId: video.washId, videoId: video.id, action: "FILES_DELETED" } });
      }
    } catch { failures++; }
  }
  await prisma.evidenceWorkerState.updateMany({ where: { id: stateId, owner }, data: { lastCleanupAt: now, lastError: failures ? "CLEANUP_FAILED" : null } });
  return failures;
}
