import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, User } from "@prisma/client";
import { prisma } from "../prisma";
import { EVIDENCE_MAX_BYTES, EVIDENCE_RETENTION_MS, EVIDENCE_UPLOAD_SECONDS, evidenceStatus, videoStatus, type EvidenceView } from "./constants";
import { headOriginal, preserveOriginal, readOriginal, uploadUrl, videoUrl } from "./storage";
import { inspectOriginal, InvalidOriginal } from "./original";

export const evidenceEnabled = () => process.env.EVIDENCE_ENABLED === "true";
export class EvidenceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const adminAccess = (user: Pick<User, "role">) => user.role === "ADMIN" || user.role === "ADMINISTRATIVE";
export function canUploadEvidence(user: Pick<User, "id" | "role">, ownerId: number) {
  return adminAccess(user) || user.id === ownerId;
}
export async function evidenceWash(washId: number, user: Pick<User, "id" | "role">, write = false) {
  if (!Number.isSafeInteger(washId) || washId <= 0) throw new EvidenceError(404, "Servicio no encontrado.");
  const wash = await prisma.wash.findFirst({ where: { id: washId, deletedAt: null, evidenceRequired: true,
    ...(adminAccess(user) ? {} : write ? { createdById: user.id } : { OR: [
      { createdById: user.id }, { participants: { some: { userId: user.id } } }, { commissions: { some: { userId: user.id } } },
    ] }),
  } });
  if (!wash) throw new EvidenceError(404, "Evidencia no disponible.");
  return wash;
}
export const activeVideos = (washId: number) => prisma.evidenceVideo.findMany({
  where: { washId, activeSlot: { not: null } }, orderBy: { zone: "asc" },
});
export async function evidenceView(washId: number, user: Pick<User, "id" | "role">): Promise<EvidenceView> {
  const wash = await evidenceWash(washId, user);
  const videos = await activeVideos(washId);
  const photos = await prisma.washPhoto.findMany({ where: { washId }, orderBy: { createdAt: "asc" } });
  const state = evidenceStatus(videos);
  return {
    washId, enabled: evidenceEnabled(), status: state,
    canManagePhotos: canUploadEvidence(user, wash.createdById),
    photos: photos.map(photo => ({ id: photo.id, clientVisible: photo.clientVisible, clientNote: photo.clientNote,
      expiresAt: photoExpiry(photo.createdAt).toISOString(), expired: photoExpiry(photo.createdAt).getTime() <= Date.now() })),
    canUpload: evidenceEnabled() && canUploadEvidence(user, wash.createdById),
    canVerify: canUploadEvidence(user, wash.createdById),
    canManageLink: user.role === "ADMIN", revoked: Boolean(wash.evidenceRevokedAt),
    sharePath: state === "READY" && wash.evidenceToken && !wash.evidenceRevokedAt ? `/evidencia/${wash.evidenceToken}` : null,
    videos: videos.map(video => ({
      id: video.id, zone: video.zone, status: videoStatus(video), note: video.note,
      uploadedAt: video.uploadedAt?.toISOString() ?? null, expiresAt: video.expiresAt?.toISOString() ?? null,
      durationSeconds: video.durationSeconds, byteSize: video.byteSize, url: null,
      error: video.errorCode ? errorText(video.errorCode) : null,
      canReplace: !video.acceptedAt || user.role === "ADMIN",
    })),
  };
}
export function errorText(code: string) {
  if (code === "INVALID_VIDEO") return "El video debe tener audio, durar hasta 45 segundos y pesar hasta 25 MB. Vuelve a grabarlo o selecciona otro archivo.";
  if (code === "UPLOAD_EXPIRED") return "La subida no se completó. Selecciona nuevamente el video.";
  return "No pudimos procesar este video. Vuelve a seleccionarlo para reintentar.";
}
const beginSchema = z.object({
  zone: z.enum(["INTERIOR", "EXTERIOR"]), requestKey: z.string().uuid(),
  contentType: z.enum(["video/mp4", "video/quicktime", "video/webm"]),
  byteSize: z.number().int().positive().max(EVIDENCE_MAX_BYTES), note: z.string().trim().max(1000).default(""),
}).strict();
export async function beginUpload(washId: number, user: User, body: unknown) {
  if (!evidenceEnabled()) throw new EvidenceError(409, "La captura de evidencia está deshabilitada temporalmente.");
  await evidenceWash(washId, user, true);
  const parsed = beginSchema.safeParse(body);
  if (!parsed.success) throw new EvidenceError(400, "Selecciona un video de hasta 25 MB y una observación de hasta 1000 caracteres.");
  const input = parsed.data;
  const record = await prisma.$transaction(async tx => {
    await lockWash(tx, washId);
    const wash = await tx.wash.findUniqueOrThrow({ where: { id: washId } });
    if (wash.deletedAt || !canUploadEvidence(user, wash.createdById)) throw new EvidenceError(403, "Acceso restringido.");
    const existing = await tx.evidenceVideo.findUnique({ where: { washId_requestKey: { washId, requestKey: input.requestKey } } });
    if (existing) {
      if (existing.uploadedById !== user.id || !existing.activeSlot) throw new EvidenceError(409, "Esta carga ya fue sustituida.");
      if (existing.zone !== input.zone || existing.contentType !== input.contentType || existing.expectedBytes !== input.byteSize) throw new EvidenceError(409, "Selecciona de nuevo el video para iniciar otra carga.");
      if (existing.status === "UPLOADING") {
        return tx.evidenceVideo.update({ where: { id: existing.id }, data: { note: input.note || null } });
      }
      return existing;
    }
    const accepted = await tx.evidenceVideo.findFirst({ where: { washId, zone: input.zone, acceptedAt: { not: null } } });
    if (accepted && user.role !== "ADMIN") throw new EvidenceError(403, "Solo un administrador puede sustituir evidencia aceptada.");
    const count = await tx.evidenceVideo.count({ where: { washId, createdAt: { gt: new Date(Date.now() - 86400000) } } });
    if (count >= 20) throw new EvidenceError(429, "Se alcanzó el límite de intentos de este servicio por hoy.");
    const previous = await tx.evidenceVideo.findUnique({ where: { activeSlot: `${washId}:${input.zone}` } });
    if (previous && ["UPLOADING", "QUEUED", "PROCESSING"].includes(previous.status) &&
        (previous.status !== "UPLOADING" || previous.uploadExpiresAt.getTime() > Date.now())) {
      throw new EvidenceError(409, "Ya hay una carga en curso para esta zona. Espera a que termine o venza.");
    }
    if (previous) await tx.evidenceVideo.update({ where: { id: previous.id }, data: { activeSlot: null, status: "SUPERSEDED" } });
    const id = randomUUID();
    const video = await tx.evidenceVideo.create({ data: {
      id, washId, zone: input.zone, activeSlot: `${washId}:${input.zone}`, requestKey: input.requestKey,
      uploadedById: user.id, note: input.note || null, originalKey: `evidence/originals/${washId}/${id}`,
      expectedBytes: input.byteSize, contentType: input.contentType,
      uploadExpiresAt: new Date(Date.now() + EVIDENCE_UPLOAD_SECONDS * 1000),
    } });
    await tx.evidenceEvent.create({ data: { washId, videoId: id, actorId: user.id, action: previous ? "UPLOAD_REPLACEMENT" : "UPLOAD_STARTED" } });
    return video;
  });
  if (record.status !== "UPLOADING") return { id: record.id, status: record.status, uploadUrl: null };
  if (record.uploadExpiresAt.getTime() <= Date.now()) throw new EvidenceError(409, "La autorización venció. Inicia un nuevo intento.");
  return { id: record.id, status: record.status, contentType: record.contentType,
    uploadUrl: await uploadUrl(record.originalKey, record.contentType, record.uploadExpiresAt, record.expectedBytes) };
}
export async function completeUpload(washId: number, videoId: string, user: User) {
  await evidenceWash(washId, user, true);
  const record = await prisma.evidenceVideo.findFirst({ where: { id: videoId, washId, activeSlot: { not: null } } });
  if (!record) throw new EvidenceError(404, "Carga no encontrada.");
  if (!["UPLOADING", "QUEUED", "PROCESSING"].includes(record.status)) return { id: record.id, status: record.status };
  if (record.status === "UPLOADING" && Date.now() > record.uploadExpiresAt.getTime() + 60000) throw new EvidenceError(409, "La carga venció. Inicia un nuevo intento.");
  const object = await headOriginal(record.originalKey).catch((error: unknown) => {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
    throw error;
  });
  if (!object) {
    if (record.status !== "UPLOADING") await prisma.evidenceVideo.updateMany({ where: { id: record.id, status: { in: ["QUEUED", "PROCESSING"] } }, data: { status: "FAILED", errorCode: "UPLOAD_EXPIRED" } });
    throw new EvidenceError(409, "El video original no está disponible. Selecciónalo de nuevo para reintentar.");
  }
  if (!object.ContentLength || object.ContentLength !== record.expectedBytes || object.ContentLength > EVIDENCE_MAX_BYTES || !object.ETag || !object.LastModified) {
    throw new EvidenceError(400, "El archivo no cumple los límites permitidos.");
  }
  if (record.originalEtag && object.ETag !== record.originalEtag) throw new EvidenceError(409, "El archivo cambió después de la subida. Selecciónalo de nuevo.");
  const uploadedAt = record.uploadedAt ?? object.LastModified;
  const expiresAt = record.expiresAt ?? new Date(uploadedAt.getTime() + EVIDENCE_RETENTION_MS);
  if (expiresAt.getTime() <= Date.now()) throw new EvidenceError(410, "La evidencia venció.");
  if (uploadedAt > record.uploadExpiresAt || uploadedAt.getTime() < record.createdAt.getTime() - 5000) throw new EvidenceError(409, "La carga venció.");
  const bytes = await readOriginal(record.originalKey, object.ETag);
  let metadata;
  try { metadata = await inspectOriginal(bytes); }
  catch (error) {
    if (!(error instanceof InvalidOriginal)) throw error;
    await prisma.evidenceVideo.updateMany({ where: { id: record.id, status: { in: ["UPLOADING", "QUEUED", "PROCESSING"] } }, data: { status: "FAILED", errorCode: "INVALID_VIDEO" } });
    throw new EvidenceError(400, errorText("INVALID_VIDEO"));
  }
  const destination = `evidence/videos/${washId}/${record.id}/original`;
  // Track the destination even if the copy succeeds but its response is lost.
  await prisma.evidenceVideo.updateMany({ where: { id: record.id, status: { in: ["UPLOADING", "QUEUED", "PROCESSING"] } }, data: { processedKey: destination } });
  return prisma.$transaction(async tx => {
    await lockWash(tx, washId);
    const current = await tx.evidenceVideo.findUniqueOrThrow({ where: { id: record.id } });
    if (current.status === "READY") return { id: current.id, status: current.status };
    const wash = await tx.wash.findUniqueOrThrow({ where: { id: washId } });
    if (wash.deletedAt || !current.activeSlot || !canUploadEvidence(user, wash.createdById)) throw new EvidenceError(409, "La evidencia ya no está disponible.");
    if (!["UPLOADING", "QUEUED", "PROCESSING"].includes(current.status) || expiresAt.getTime() <= Date.now()) throw new EvidenceError(409, "La carga ya no puede confirmarse.");
    // Copy bytes unchanged to a private key the browser can never overwrite.
    await preserveOriginal(record.originalKey, destination, object.ETag!, metadata.contentType);
    await tx.evidenceVideo.update({ where: { id: record.id }, data: {
      status: "READY", processedKey: destination, contentType: metadata.contentType,
      originalEtag: object.ETag, uploadedAt, expiresAt, acceptedAt: new Date(),
      byteSize: bytes.length, durationSeconds: metadata.duration, width: metadata.width,
      height: metadata.height, processingOwner: null, errorCode: null,
    } });
    await tx.evidenceEvent.create({ data: { washId, videoId: record.id, actorId: user.id, action: "ORIGINAL_VIDEO_ACCEPTED" } });
    return { id: record.id, status: "READY" };
  }, { timeout: 65000 });
}
export async function lockWash(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT id FROM Wash WHERE id = ${id} FOR UPDATE`;
}
export async function manageShare(washId: number, user: User, action: unknown) {
  await evidenceWash(washId, user, true);
  if (!["create", "revoke", "rotate"].includes(String(action))) throw new EvidenceError(400, "Acción inválida.");
  if (action !== "create" && user.role !== "ADMIN") throw new EvidenceError(403, "Acceso restringido.");
  return prisma.$transaction(async tx => {
    await lockWash(tx, washId);
    const wash = await tx.wash.findUniqueOrThrow({ where: { id: washId } });
    if (wash.deletedAt || !canUploadEvidence(user, wash.createdById)) throw new EvidenceError(404, "Servicio no encontrado.");
    if (action === "revoke") {
      await tx.wash.update({ where: { id: washId }, data: { evidenceToken: null, evidenceRevokedAt: new Date() } });
    } else {
      if (wash.evidenceRevokedAt && action === "create") throw new EvidenceError(403, "Solo un administrador puede generar otro enlace después de revocarlo.");
      const videos = await tx.evidenceVideo.findMany({ where: { washId, activeSlot: { not: null } } });
      if (evidenceStatus(videos) !== "READY") throw new EvidenceError(409, "Ambos videos deben estar listos y vigentes.");
      if (!wash.evidenceToken || action === "rotate") await tx.wash.update({ where: { id: washId }, data: { evidenceToken: randomBytes(32).toString("hex"), evidenceRevokedAt: null } });
    }
    await tx.evidenceEvent.create({ data: { washId, actorId: user.id, action: `LINK_${String(action).toUpperCase()}` } });
    return { ok: true };
  });
}
export async function publicEvidence(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const wash = await prisma.wash.findFirst({ where: { evidenceToken: token, evidenceRevokedAt: null, deletedAt: null, evidenceRequired: true },
    select: { id: true, vehicleType: { select: { name: true } }, package: { select: { name: true } },
      photos: { where: { clientVisible: true, createdAt: { gt: new Date(Date.now() - EVIDENCE_RETENTION_MS) } }, orderBy: { createdAt: "asc" }, select: { id: true, clientNote: true, createdAt: true, width: true, height: true } },
      evidenceVideos: { where: { activeSlot: { not: null } }, orderBy: { zone: "asc" }, select: { id: true, zone: true, status: true, note: true, expiresAt: true } } },
  });
  if (!wash) return null;
  return { washId: wash.id, vehicle: wash.vehicleType.name, service: wash.package.name,
    photos: wash.photos.map(photo => ({ id: photo.id, width: photo.width, height: photo.height, note: photo.clientNote, expiresAt: photoExpiry(photo.createdAt).toISOString() })),
    videos: wash.evidenceVideos.map(v => ({ id: v.id, zone: v.zone, note: v.note, status: videoStatus(v), expiresAt: v.expiresAt?.toISOString() ?? null })),
  };
}
export async function playableVideo(washId: number, videoId: string) {
  const video = await prisma.evidenceVideo.findFirst({ where: {
    id: videoId, washId, activeSlot: { not: null }, status: "READY", expiresAt: { gt: new Date() },
    wash: { deletedAt: null },
  } });
  if (!video?.processedKey || !video.expiresAt) throw new EvidenceError(410, "Este video ya no está disponible.");
  return { url: await videoUrl(video.processedKey, video.expiresAt, video.processedKey.endsWith("/original") ? video.contentType : "video/mp4"), expiresAt: video.expiresAt.toISOString() };
}

export const photoExpiry = (uploadedAt: Date) => new Date(uploadedAt.getTime() + EVIDENCE_RETENTION_MS);
const photoVisibilitySchema = z.object({ clientVisible: z.boolean(), clientNote: z.string().trim().max(1000) }).strict();
export async function updatePhotoVisibility(washId: number, photoId: number, user: User, body: unknown) {
  await evidenceWash(washId, user, true);
  const parsed = photoVisibilitySchema.safeParse(body);
  if (!parsed.success) throw new EvidenceError(400, "Indica la visibilidad y una observación de hasta 1000 caracteres.");
  if (!Number.isSafeInteger(photoId) || photoId <= 0) throw new EvidenceError(404, "Foto no encontrada.");
  await prisma.$transaction(async tx => {
    await lockWash(tx, washId);
    const wash = await tx.wash.findUniqueOrThrow({ where: { id: washId } });
    if (wash.deletedAt || !canUploadEvidence(user, wash.createdById)) throw new EvidenceError(404, "Servicio no encontrado.");
    const photo = await tx.washPhoto.findFirst({ where: { id: photoId, washId } });
    if (!photo) throw new EvidenceError(404, "Foto no encontrada.");
    if (parsed.data.clientVisible && photoExpiry(photo.createdAt).getTime() <= Date.now()) throw new EvidenceError(410, "La disponibilidad de esta foto para el cliente ya venció.");
    const note = parsed.data.clientNote || null;
    if (photo.clientVisible === parsed.data.clientVisible && photo.clientNote === note) return;
    await tx.washPhoto.update({ where: { id: photoId }, data: { clientVisible: parsed.data.clientVisible, clientNote: note } });
    await tx.evidenceEvent.create({ data: { washId, actorId: user.id, action: `PHOTO_${photoId}_${parsed.data.clientVisible ? "SHARED" : "PRIVATE"}` } });
  });
  return { ok: true };
}
