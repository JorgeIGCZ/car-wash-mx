import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { EVIDENCE_UPLOAD_SECONDS } from "./constants";

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
export async function videoUrl(key: string, expiresAt: Date) {
  const seconds = Math.min(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  if (seconds <= 0) return null;
  const { client, bucket } = evidenceStorage();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key,
    ResponseContentType: "video/mp4", ResponseCacheControl: "private, no-store",
    ResponseContentDisposition: "inline",
  }), { expiresIn: seconds });
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
