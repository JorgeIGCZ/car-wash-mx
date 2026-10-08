import { GetBucketCorsCommand, GetBucketLifecycleConfigurationCommand, PutBucketCorsCommand, PutBucketLifecycleConfigurationCommand, type LifecycleRule, type CORSRule } from "@aws-sdk/client-s3";
import { evidenceStorage } from "../src/lib/evidence/storage";

async function main() {
  const origins = (process.env.EVIDENCE_ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => {
    const url = new URL(origin);
    return url.origin !== origin || (url.protocol !== "https:" && !(process.env.APP_ENV === "local" && ["localhost", "127.0.0.1"].includes(url.hostname)));
  })) throw new Error("Define EVIDENCE_ALLOWED_ORIGINS with exact HTTPS origins, separated by commas.");
  const { client, bucket } = evidenceStorage();
  const lifecycle = await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket })).catch(error => {
    if (error?.name === "NoSuchLifecycleConfiguration" || error?.$metadata?.httpStatusCode === 404) return { Rules: [] as LifecycleRule[] };
    throw error;
  });
  const cors = await client.send(new GetBucketCorsCommand({ Bucket: bucket })).catch(error => {
    if (error?.name === "NoSuchCORSConfiguration" || error?.$metadata?.httpStatusCode === 404) return { CORSRules: [] as CORSRule[] };
    throw error;
  });
  const rules: LifecycleRule[] = [
    { ID: "turbo-evidence-originals", Status: "Enabled", Filter: { Prefix: "evidence/originals/" }, Expiration: { Days: 1 }, AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 } },
    { ID: "turbo-evidence-videos", Status: "Enabled", Filter: { Prefix: "evidence/videos/" }, Expiration: { Days: 10 } },
  ];
  const newLifecycle = [...(lifecycle.Rules ?? []).filter(r => !rules.some(n => n.ID === r.ID)), ...rules];
  const rule: CORSRule = { ID: "turbo-evidence", AllowedOrigins: origins, AllowedMethods: ["GET", "HEAD", "PUT"], AllowedHeaders: ["content-type", "range", "x-amz-*"], ExposeHeaders: ["ETag", "Content-Length", "Content-Range"], MaxAgeSeconds: 300 };
  const newCors = [...(cors.CORSRules ?? []).filter(r => r.ID !== rule.ID), rule];
  console.log(JSON.stringify({ apply: process.argv.includes("--apply"), evidenceLifecycle: rules, evidenceCors: rule, preservedLifecycleRules: newLifecycle.length - rules.length, preservedCorsRules: newCors.length - 1 }, null, 2));
  if (!process.argv.includes("--apply")) return;
  await client.send(new PutBucketLifecycleConfigurationCommand({ Bucket: bucket, LifecycleConfiguration: { Rules: newLifecycle } }));
  await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: newCors } }));
  console.log("Evidence lifecycle and CORS rules applied; existing unrelated rules preserved.");
}
main().catch(() => { console.error("R2 configuration failed. Check origins and bucket permissions; no credentials were logged."); process.exitCode = 1; });
