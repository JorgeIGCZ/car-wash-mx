// Disposable S3-compatible test fixture. Never use as application storage.
import { createServer } from "node:http";
import { createHash } from "node:crypto";
if (process.env.APP_ENV !== "local") throw new Error("Only available in local tests");
const objects = new Map<string, { body: Buffer; type: string; etag: string; modified: Date }>();
let failDeletes = false;
const server = createServer(async (request, response) => {
  const path = new URL(request.url || "/", "http://localhost").pathname;
  response.setHeader("Access-Control-Allow-Origin", process.env.EVIDENCE_TEST_ORIGIN || "http://127.0.0.1:3012");
  response.setHeader("Access-Control-Allow-Methods", "GET,PUT,HEAD,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "content-type,range");
  response.setHeader("Access-Control-Expose-Headers", "ETag,Content-Length,Content-Range");
  if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
  if (path === "/_test/fail-deletes") { failDeletes = request.method === "POST"; response.end("ok"); return; }
  if (request.method === "PUT") {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks); const etag = `"${createHash("md5").update(body).digest("hex")}"`;
    objects.set(path, { body, type: String(request.headers["content-type"] || "application/octet-stream"), etag, modified: new Date() });
    response.setHeader("ETag", etag); response.end(); return;
  }
  if (request.method === "DELETE") { if (failDeletes) { response.writeHead(503).end(); return; } objects.delete(path); response.writeHead(204).end(); return; }
  const object = objects.get(path);
  if (!object) { response.writeHead(404, {"Content-Type":"application/xml"}).end('<Error><Code>NoSuchKey</Code></Error>'); return; }
  if (request.headers["if-match"] && request.headers["if-match"] !== object.etag) { response.writeHead(412).end(); return; }
  response.setHeader("Content-Type", object.type); response.setHeader("ETag", object.etag); response.setHeader("Last-Modified", object.modified.toUTCString());
  response.setHeader("Accept-Ranges", "bytes");
  const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  const start = range ? Number(range[1]) : 0; const end = range && range[2] ? Math.min(Number(range[2]), object.body.length - 1) : object.body.length - 1;
  response.setHeader("Content-Length", end - start + 1);
  if (range) { response.statusCode = 206; response.setHeader("Content-Range", `bytes ${start}-${end}/${object.body.length}`); }
  response.end(request.method === "HEAD" ? undefined : object.body.subarray(start, end + 1));
});
const port = Number(process.env.EVIDENCE_FAKE_STORAGE_PORT || 3013);
server.listen(port, "127.0.0.1", () => console.log(`Disposable video storage listening on 127.0.0.1:${port}`));
