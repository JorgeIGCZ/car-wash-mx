export const EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;
export const EVIDENCE_MAX_SECONDS = 45;
export const EVIDENCE_RETENTION_MS = 10 * 24 * 60 * 60 * 1000;
export const EVIDENCE_UPLOAD_SECONDS = 5 * 60;
export const EVIDENCE_ZONES = ["INTERIOR", "EXTERIOR"] as const;
export type EvidenceZoneName = (typeof EVIDENCE_ZONES)[number];
export const zoneLabels = { INTERIOR: "Interior", EXTERIOR: "Exterior" };
export const evidenceLabels = {
  PENDING: "Evidencia pendiente", UPLOADING: "Subiendo", QUEUED: "Procesando",
  PROCESSING: "Procesando", READY: "Completa", FAILED: "Evidencia pendiente",
  EXPIRED: "Vencida", SUPERSEDED: "Sustituida",
};
export type EvidenceDisplayStatus = keyof typeof evidenceLabels;
export type EvidenceVideoView = {
  id: string; zone: EvidenceZoneName; status: EvidenceDisplayStatus;
  note: string | null; uploadedAt: string | null; expiresAt: string | null;
  durationSeconds: number | null; byteSize: number | null;
  url: string | null; error: string | null; canReplace: boolean;
};
export type EvidencePhotoView = {
  id: number; clientVisible: boolean; clientNote: string | null; expiresAt: string; expired: boolean;
};
export type EvidenceView = {
  washId: number; enabled: boolean; status: EvidenceDisplayStatus;
  canUpload: boolean; canManageLink: boolean; sharePath: string | null;
  revoked: boolean; videos: EvidenceVideoView[];
  canManagePhotos: boolean; photos: EvidencePhotoView[];
};
export function videoStatus(video: {status: EvidenceDisplayStatus; expiresAt: Date | string | null; uploadExpiresAt?: Date | string}, now = Date.now()): EvidenceDisplayStatus {
  if (video.status === "UPLOADING" && video.uploadExpiresAt && new Date(video.uploadExpiresAt).getTime() + 60000 <= now) return "FAILED";
  if (video.expiresAt && new Date(video.expiresAt).getTime() <= now) return "EXPIRED";
  return video.status;
}
export function evidenceStatus(videos: {status: EvidenceDisplayStatus; expiresAt: Date | string | null}[], now = Date.now()): EvidenceDisplayStatus {
  const states = videos.map(v => videoStatus(v, now));
  if (states.includes("EXPIRED")) return "EXPIRED";
  if (states.length === 2 && states.every(s => s === "READY")) return "READY";
  if (states.some(s => s === "QUEUED" || s === "PROCESSING")) return "PROCESSING";
  if (states.includes("UPLOADING")) return "UPLOADING";
  return "PENDING";
}
