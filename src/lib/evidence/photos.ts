import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../prisma";
import { evidenceStorage } from "./storage";
import { EvidenceError, photoExpiry } from "./service";

// Proxy public photos to avoid inheriting the private originals' long cache policy.
// The caller must authorize the wash and (for public requests) the current token.
export async function photoResponse(washId: number, photoId: number, publicAccess: boolean) {
  if (!Number.isSafeInteger(photoId) || photoId <= 0) throw new EvidenceError(404, "Foto no disponible.");
  const photo = await prisma.washPhoto.findFirst({ where: { id: photoId, washId, wash: { deletedAt: null },
    ...(publicAccess ? { clientVisible: true } : {}) } });
  if (!photo) throw new EvidenceError(404, "Foto no disponible.");
  if (publicAccess && photoExpiry(photo.createdAt).getTime() <= Date.now()) throw new EvidenceError(410, "La foto ya venció.");
  const { client, bucket } = evidenceStorage();
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: photo.objectKey }));
  if (!object.Body) throw new EvidenceError(404, "Foto no disponible.");
  return new Response(object.Body.transformToWebStream(), { headers: {
    "Content-Type": photo.mimeType, "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline",
    "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive",
  } });
}
