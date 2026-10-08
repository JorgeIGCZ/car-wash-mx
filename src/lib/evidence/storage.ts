import { CopyObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { EVIDENCE_MAX_BYTES, EVIDENCE_UPLOAD_SECONDS } from "./constants";

// Separate from photo storage: videos must never inherit its year-long cache policy.
export function evidenceStorage() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) throw new Error("EVIDENCE_STORAGE_UNAVAILABLE");
  const endpoint = process.env.APP_ENV === "local" && process.env.R2_TEST_ENDPOINT
    ? process.env.R2_TEST_ENDPOINT : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return {
    bucket: R2_BUCKET_NAME,
    client: new S3Client({ region: "auto", endpoint, forcePathStyle: true,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
}
export async function uploadUrl(key: string, contentType: string, expiresAt: Date, byteSize: number) {
  const { client, bucket } = evidenceStorage();
  const seconds = Math.min(EVIDENCE_UPLOAD_SECONDS, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  if (seconds <= 0) throw new Error("UPLOAD_EXPIRED");
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: byteSize }), { expiresIn: seconds });
}
export async function videoUrl(key: string, expiresAt: Date, contentType = "video/mp4") {
  const seconds = Math.min(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  if (seconds <= 0) return null;
  const { client, bucket } = evidenceStorage();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key,
    ResponseContentType: contentType, ResponseCacheControl: "private, no-store",
    ResponseContentDisposition: "inline",
  }), { expiresIn: seconds });
}
export async function readOriginal(key: string, etag: string) {
  const { client, bucket } = evidenceStorage();
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, IfMatch: etag }), { abortSignal: AbortSignal.timeout(60000) });
  if (!object.Body || !object.ContentLength || object.ContentLength > EVIDENCE_MAX_BYTES) throw new Error("INVALID_VIDEO");
  const chunks: Buffer[] = []; let bytes = 0;
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
    bytes += chunk.length;
    if (bytes > EVIDENCE_MAX_BYTES) throw new Error("INVALID_VIDEO");
    chunks.push(Buffer.from(chunk));
  }
  if (bytes !== object.ContentLength) throw new Error("INVALID_VIDEO");
  return Buffer.concat(chunks);
}
export async function preserveOriginal(key: string, destination: string, etag: string, contentType: string) {
  const { client, bucket } = evidenceStorage();
  await client.send(new CopyObjectCommand({ Bucket: bucket, Key: destination,
    CopySource: `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`, CopySourceIfMatch: etag,
    MetadataDirective: "REPLACE", ContentType: contentType, CacheControl: "private, no-store",
  }), { abortSignal: AbortSignal.timeout(60000) });
}
export async function headOriginal(key: string) {
  const { client, bucket } = evidenceStorage();
  return client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}
export async function removeVideoObject(key: string) {
  if (!key.startsWith("evidence/originals/") && !key.startsWith("evidence/videos/")) throw new Error("INVALID_EVIDENCE_KEY");
  const { client, bucket } = evidenceStorage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
