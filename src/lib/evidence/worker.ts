import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../prisma";
import { EVIDENCE_MAX_BYTES } from "./constants";
import { evidenceStorage, removeVideoObject } from "./storage";
import { InvalidVideo, normalizeVideo } from "./processor";

export async function acquireLease(owner: string) {
  const now = new Date();
  await prisma.evidenceWorkerState.upsert({ where: { id: "main" }, create: { id: "main", owner, leaseUntil: now, heartbeatAt: now }, update: {} });
  const claim = await prisma.evidenceWorkerState.updateMany({ where: { id: "main", OR: [{ owner }, { leaseUntil: { lt: now } }] },
    data: { owner, heartbeatAt: now, leaseUntil: new Date(Date.now() + 120000) } });
  return claim.count === 1;
}
export async function recoverJobs(owner: string) {
  // Lease is acquired before this runs; discard scratch files from a dead worker.
  for (const entry of await readdir(tmpdir(), { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith("wash-video-")) await rm(join(tmpdir(), entry.name), { recursive: true, force: true });
  }
  await prisma.evidenceVideo.updateMany({ where: { status: "PROCESSING", NOT: { processingOwner: owner } },
    data: { status: "QUEUED", processingOwner: null, nextAttemptAt: new Date() } });
}
export async function processOne(owner: string) {
  const candidate = await prisma.evidenceVideo.findFirst({ where: { status: "QUEUED", nextAttemptAt: { lte: new Date() },
    activeSlot: { not: null }, expiresAt: { gt: new Date() }, wash: { deletedAt: null },
  }, orderBy: { uploadedAt: "asc" } });
  if (!candidate) return false;
  const claim = await prisma.evidenceVideo.updateMany({ where: { id: candidate.id, status: "QUEUED" },
    data: { status: "PROCESSING", processingOwner: owner, attempts: { increment: 1 }, errorCode: null } });
  if (!claim.count) return true;
  const directory = await mkdtemp(join(tmpdir(), "wash-video-"));
  const outputKey = `evidence/videos/${candidate.washId}/${candidate.id}/${randomUUID()}.mp4`;
  let uploaded = false;
  try {
    if (candidate.processedKey) await removeVideoObject(candidate.processedKey);
    const { client, bucket } = evidenceStorage();
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: candidate.originalKey, IfMatch: candidate.originalEtag ?? undefined }), { abortSignal: AbortSignal.timeout(60000) });
    if (!object.Body || !object.ContentLength || object.ContentLength > EVIDENCE_MAX_BYTES || object.ContentLength !== candidate.expectedBytes) throw new InvalidVideo("INVALID_VIDEO");
    let bytes = 0;
    const limit = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > EVIDENCE_MAX_BYTES ? new InvalidVideo("INVALID_VIDEO") : null, chunk);
    } });
    const input = join(directory, "input");
    const output = join(directory, "output.mp4");
    await pipeline(object.Body as Readable, limit, createWriteStream(input), { signal: AbortSignal.timeout(60000) });
    const metadata = await normalizeVideo(input, output);
    const size = (await stat(output)).size;
    // Persist the destination before upload so a crash leaves a tracked object.
    const reserved = await prisma.evidenceVideo.updateMany({ where: { id: candidate.id, status: "PROCESSING", processingOwner: owner }, data: { processedKey: outputKey } });
    if (!reserved.count) return true;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: outputKey, Body: createReadStream(output), ContentLength: size,
      ContentType: "video/mp4", CacheControl: "private, no-store" }), { abortSignal: AbortSignal.timeout(60000) });
    uploaded = true;
    const accepted = await prisma.evidenceVideo.updateMany({ where: { id: candidate.id, status: "PROCESSING", processingOwner: owner,
      activeSlot: { not: null }, expiresAt: { gt: new Date() }, wash: { deletedAt: null } },
      data: { status: "READY", processedKey: outputKey, acceptedAt: new Date(), byteSize: size,
        durationSeconds: metadata.duration, width: metadata.width, height: metadata.height, processingOwner: null } });
    if (!accepted.count) { await removeVideoObject(outputKey); return true; }
    await prisma.evidenceEvent.create({ data: { washId: candidate.washId, videoId: candidate.id, action: "VIDEO_ACCEPTED" } });
    // Wait until the upload URL is unusable before marking original deletion final.
    await removeVideoObject(candidate.originalKey);
    if (candidate.uploadExpiresAt.getTime() + 60000 < Date.now()) {
      await prisma.evidenceVideo.update({ where: { id: candidate.id }, data: { originalDeletedAt: new Date() } });
    }
  } catch (error) {
    const invalid = error instanceof InvalidVideo;
    const terminal = invalid || candidate.attempts >= 2;
    // Do not downgrade a READY video if only the original cleanup failed.
    await prisma.evidenceVideo.updateMany({ where: { id: candidate.id, status: "PROCESSING", processingOwner: owner }, data: {
      status: terminal ? "FAILED" : "QUEUED", errorCode: invalid ? "INVALID_VIDEO" : "PROCESSING_FAILED",
      processingOwner: null, nextAttemptAt: new Date(Date.now() + 60000 * (candidate.attempts + 1)),
    } });
    const current = await prisma.evidenceVideo.findUnique({ where: { id: candidate.id }, select: { processedKey: true } });
    if (uploaded && current?.processedKey !== outputKey) await removeVideoObject(outputKey).catch(() => undefined);
    await prisma.evidenceEvent.create({ data: { washId: candidate.washId, videoId: candidate.id, action: invalid ? "VIDEO_REJECTED" : "PROCESSING_RETRY_OR_CLEANUP" } });
  } finally { await rm(directory, { recursive: true, force: true }); }
  return true;
}
export async function cleanupEvidence(owner: string, now = new Date()) {
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
  await prisma.evidenceWorkerState.updateMany({ where: { id: "main", owner }, data: { lastCleanupAt: now, lastError: failures ? "CLEANUP_FAILED" : null } });
  return failures;
}
