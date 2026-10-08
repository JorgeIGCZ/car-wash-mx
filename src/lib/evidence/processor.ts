import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { EVIDENCE_MAX_BYTES, EVIDENCE_MAX_SECONDS } from "./constants";
const exec = promisify(execFile);
export class InvalidVideo extends Error {}
export async function probeVideo(path: string) {
  const { stdout } = await exec(process.env.FFPROBE_PATH || "ffprobe", [
    "-v", "error", "-protocol_whitelist", "file,pipe", "-show_format", "-show_streams", "-of", "json", path,
  ], { timeout: 30000, maxBuffer: 1024 * 1024 });
  const info = JSON.parse(stdout) as { format: {duration?: string; size?: string}; streams: {codec_type: string; codec_name: string; width?: number; height?: number; duration?: string}[] };
  const video = info.streams.find(s => s.codec_type === "video");
  const audio = info.streams.find(s => s.codec_type === "audio");
  let duration = Number(info.format.duration);
  // MediaRecorder WebM commonly omits container duration; inspect packet timing.
  if (!Number.isFinite(duration)) {
    const packets = await exec(process.env.FFPROBE_PATH || "ffprobe", [
      "-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries", "packet=pts_time,duration_time", "-of", "csv=p=0", path,
    ], { timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    let first = Infinity; let last = -Infinity;
    for (const line of packets.stdout.split("\n")) {
      const [timestamp, length] = line.split(",").map(Number);
      if (!line || !Number.isFinite(timestamp)) continue;
      first = Math.min(first, timestamp);
      last = Math.max(last, timestamp + (Number.isFinite(length) ? length : 0));
    }
    duration = last - first;
  }
  if (!video || !audio || !Number.isFinite(duration) || duration <= 0 || duration > EVIDENCE_MAX_SECONDS + 0.15 ||
      !video.width || !video.height || video.width > 4096 || video.height > 4096 ||
      Number(info.format.size) > EVIDENCE_MAX_BYTES) throw new InvalidVideo("INVALID_VIDEO");
  return { duration, width: video.width, height: video.height };
}
export async function normalizeVideo(input: string, output: string) {
  try { await probeVideo(input); } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") throw error;
    throw new InvalidVideo("INVALID_VIDEO");
  }
  await exec(process.env.FFMPEG_PATH || "ffmpeg", [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file,pipe", "-i", input,
    "-map", "0:v:0", "-map", "0:a:0", "-map_metadata", "-1",
    "-vf", "scale='if(gte(iw,ih),min(1280,iw),min(720,iw))':'if(gte(iw,ih),min(720,ih),min(1280,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
    "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-maxrate", "1800k", "-bufsize", "3600k",
    "-pix_fmt", "yuv420p", "-threads", "1", "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart", "-y", output,
  ], { timeout: 120000, maxBuffer: 1024 * 1024 });
  return probeVideo(output);
}
