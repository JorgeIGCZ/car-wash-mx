"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Square, Upload, X } from "lucide-react";
import { EVIDENCE_MAX_BYTES, EVIDENCE_MAX_SECONDS } from "@/lib/evidence/constants";
export type EvidenceDraft = { file: File; note: string; requestKey: string; videoId?: string };
export function EvidenceCapture({ label, disabled, draft, onChange, onRecording }: {
  label: string; disabled: boolean; draft: EvidenceDraft | null; onChange: (draft: EvidenceDraft | null) => void; onRecording: (recording: boolean) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const live = useRef<HTMLVideoElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (timer.current) clearInterval(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop()); };
  }, []);
  const selectedFile = draft?.file;
  useEffect(() => {
    if (!selectedFile) { setPreview(null); return; }
    const url = URL.createObjectURL(selectedFile); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);
  function stop() { if (recorder.current?.state === "recording") recorder.current.stop(); }
  async function choose(file?: File) {
    if (!file) return;
    setError("");
    if (file.size > EVIDENCE_MAX_BYTES || !file.size) { setError("El video debe pesar hasta 25 MB. Grábalo con menor calidad o vuelve a grabarlo desde aquí."); return; }
    const allowed = ["video/mp4", "video/quicktime", "video/webm"];
    if (!allowed.includes(file.type.split(";")[0])) { setError("Selecciona un video MP4, MOV o WebM."); return; }
    const url = URL.createObjectURL(file);
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const video = document.createElement("video"); video.preload = "metadata";
        const timeout = setTimeout(() => { video.removeAttribute("src"); video.load(); reject(new Error("No fue posible revisar el video. Intenta con otro archivo.")); }, 10000);
        video.onloadedmetadata = () => { clearTimeout(timeout); const value = video.duration; video.removeAttribute("src"); video.load(); resolve(value); };
        video.onerror = () => { clearTimeout(timeout); reject(new Error("Este teléfono no puede abrir el archivo seleccionado.")); };
        video.src = url;
      });
      // Some browser recordings have unknown duration; server validation remains mandatory.
      if (Number.isFinite(duration) && duration > EVIDENCE_MAX_SECONDS + 0.15) throw new Error("El video supera 45 segundos. Selecciona otro o vuelve a grabarlo; no se recortará automáticamente.");
      if (mounted.current) onChange({ file, note: draft?.note ?? "", requestKey: crypto.randomUUID() });
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Video inválido."); }
    finally { URL.revokeObjectURL(url); }
  }
  async function start() {
    setStarting(true); onRecording(true); setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("La grabación no está disponible en este navegador. Usa la cámara del teléfono y selecciona el video de la galería.");
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }, audio: true });
      if (!mounted.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const type = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp8,opus", "video/mp4", "video/webm"].find(t => MediaRecorder.isTypeSupported(t));
      if (!type) throw new Error("Usa la cámara del teléfono y selecciona el archivo desde la galería.");
      const capture = new MediaRecorder(media, { mimeType: type, videoBitsPerSecond: 1500000, audioBitsPerSecond: 64000 });
      recorder.current = capture;
      const chunks: Blob[] = [];
      let bytes = 0; let failed = false;
      capture.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); bytes += event.data.size; if (bytes > EVIDENCE_MAX_BYTES) { failed = true; stop(); } } };
      capture.onerror = () => { failed = true; stop(); };
      capture.onstop = () => {
        if (timer.current) clearInterval(timer.current);
        media.getTracks().forEach(t => t.stop()); stream.current = null;
        if (!mounted.current) return;
        setRecording(false); onRecording(false);
        if (failed) { setError("La grabación se interrumpió o superó 25 MB. Vuelve a grabarla."); return; }
        const mime = capture.mimeType.split(";")[0];
        void choose(new File(chunks, `evidencia-${label.toLowerCase()}.${mime === "video/mp4" ? "mp4" : "webm"}`, { type: mime }));
      };
      capture.start(250); setRecording(true); setSeconds(0);
      if (live.current) { live.current.srcObject = media; void live.current.play(); }
      const started = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000); setSeconds(elapsed);
        if (Date.now() - started >= EVIDENCE_MAX_SECONDS * 1000 - 500) stop();
      }, 100);
    } catch (e) {
      stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
      onRecording(false); setError(e instanceof Error && e.name === "NotAllowedError" ? "Permite el acceso a cámara y micrófono, o selecciona un video de la galería." : e instanceof Error ? e.message : "No se pudo abrir la cámara.");
    } finally { if (mounted.current) setStarting(false); }
  }
  return <div className="evidence-capture">
    <video ref={live} className={recording ? "" : "evidence-hidden"} muted playsInline aria-label={`Cámara ${label}`} />
    {recording ? <button type="button" className="secondary-button" onClick={stop}><Square size={16} />Detener · {seconds}/45 s</button> : <>
      {preview && <video src={preview} controls playsInline preload="metadata" aria-label={`Vista previa ${label}`} />}
      <div className="evidence-actions">
        <button type="button" className="secondary-button" disabled={disabled || starting} onClick={() => void start()}><Camera size={17}/>{starting ? "Abriendo cámara…" : draft ? "Volver a grabar" : "Grabar video"}</button>
        <label className="secondary-button evidence-file"><Upload size={17}/>Galería<input type="file" accept="video/mp4,video/quicktime,video/webm" disabled={disabled || starting} onChange={e => { void choose(e.target.files?.[0]); e.target.value = ""; }} /></label>
        {draft && <button type="button" className="icon-button" aria-label={`Quitar video ${label}`} disabled={disabled} onClick={() => onChange(null)}><X size={18}/></button>}
      </div>
    </>}
    {draft && <><small>{(draft.file.size / 1024 / 1024).toFixed(1)} MB · Revisa el video antes de subir.</small>
      <label>Observación visible para el cliente<textarea maxLength={1000} value={draft.note} disabled={disabled || recording || Boolean(draft.videoId)} onChange={e => onChange({ ...draft, note: e.target.value, requestKey: crypto.randomUUID(), videoId: undefined })} placeholder="Ej. Mancha previa en asiento trasero" /></label>
      <a href={preview ?? undefined} download={draft.file.name}>Guardar una copia en este teléfono</a>
    </>}
    {error && <p role="alert" className="evidence-error">{error}</p>}
  </div>;
}
