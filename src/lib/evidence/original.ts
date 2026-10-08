import mediaInfoFactory from "mediainfo.js";
import { EVIDENCE_MAX_BYTES, EVIDENCE_MAX_SECONDS } from "./constants";

export class InvalidOriginal extends Error {}

// MediaRecorder WebM often omits Duration. Read actual block timestamps instead.
// Only unlaced blocks are supported for that fallback; unknown input fails closed.
export function webmDuration(data: Buffer, finalPacket = 0.1) {
  let offset = 0, scale = 1_000_000, cluster = 0, maximum = -1, blocks = 0;
  const masters = new Set([0x1a45dfa3, 0x18538067, 0x1549a966, 0x1f43b675, 0xa0]);
  function vint(at: number, id = false) {
    if (at >= data.length || !data[at]) throw new InvalidOriginal();
    let width = 1; while (width <= 8 && !(data[at] & (0x80 >> (width - 1)))) width++;
    if (width > (id ? 4 : 8) || at + width > data.length) throw new InvalidOriginal();
    let value = id ? data[at] : data[at] & ((0x80 >> (width - 1)) - 1);
    let unknown = !id && value === ((0x80 >> (width - 1)) - 1);
    for (let i = 1; i < width; i++) { value = value * 256 + data[at + i]; unknown = unknown && data[at + i] === 255; }
    if (!unknown && !Number.isSafeInteger(value)) throw new InvalidOriginal();
    return { value, width, unknown };
  }
  let elements = 0;
  while (offset < data.length) {
    if (++elements > 500000) throw new InvalidOriginal();
    const id = vint(offset, true); offset += id.width;
    const length = vint(offset); offset += length.width;
    if (masters.has(id.value)) {
      if (!length.unknown && offset + length.value > data.length) throw new InvalidOriginal();
      if (id.value === 0x1f43b675) cluster = 0;
      continue;
    }
    if (length.unknown || offset + length.value > data.length) throw new InvalidOriginal();
    if (id.value === 0x2ad7b1 || id.value === 0xe7) {
      if (!length.value || length.value > 6) throw new InvalidOriginal();
      const value = data.readUIntBE(offset, length.value);
      if (id.value === 0x2ad7b1) scale = value; else cluster = value;
    }
    if (id.value === 0xa3 || id.value === 0xa1) {
      const track = vint(offset);
      if (length.value < track.width + 3 || (data[offset + track.width + 2] & 6)) throw new InvalidOriginal();
      maximum = Math.max(maximum, cluster + data.readInt16BE(offset + track.width)); blocks++;
    }
    offset += length.value;
  }
  if (!blocks || maximum <= 0 || scale <= 0) throw new InvalidOriginal();
  // Include the final frame/audio packet rather than undercount its start time.
  return maximum * scale / 1e9 + finalPacket;
}

export async function inspectOriginal(data: Buffer) {
  if (!data.length || data.length > EVIDENCE_MAX_BYTES) throw new InvalidOriginal();
  const info = await mediaInfoFactory({ format: "object" });
  try {
    const result = await info.analyzeData(data.length, (size, offset) => data.subarray(offset, offset + size));
    const tracks = result.media?.track ?? [];
    const general = tracks.find(t => t["@type"] === "General");
    const video = tracks.find(t => t["@type"] === "Video");
    const audio = tracks.find(t => t["@type"] === "Audio");
    const format = general?.Format;
    if (!video || !audio || !["MPEG-4", "WebM"].includes(String(format))) throw new InvalidOriginal();
    // Restrict to browser video/audio codecs. No conversion or codec promises.
    if (!["AVC", "HEVC", "VP8", "VP9", "AV1"].includes(String(video.Format)) || !["AAC", "Opus", "Vorbis", "PCM"].includes(String(audio.Format))) throw new InvalidOriginal();
    const known = Math.max(Number(general?.Duration) || 0, Number(video.Duration) || 0, Number(audio.Duration) || 0);
    const frameRate = Number(video.FrameRate) || Number(general?.FrameRate);
    if (format === "WebM" && (!Number.isFinite(frameRate) || frameRate <= 0)) throw new InvalidOriginal();
    const duration = format === "WebM" ? Math.max(known, webmDuration(data, Math.max(0.1, 1 / frameRate))) : known;
    const width = Number(video.Width), height = Number(video.Height);
    if (!Number.isFinite(duration) || duration <= 0 || duration > EVIDENCE_MAX_SECONDS + 0.15 || !width || !height) throw new InvalidOriginal();
    const contentType = format === "WebM" ? "video/webm" : general?.Format_Profile === "QuickTime" ? "video/quicktime" : "video/mp4";
    return { duration, width, height, contentType };
  } catch { throw new InvalidOriginal(); }
  finally { info.close(); }
}
