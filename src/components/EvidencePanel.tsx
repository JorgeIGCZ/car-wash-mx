"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Copy, ExternalLink, LoaderCircle, MessageCircle, RefreshCw, Upload, Video } from "lucide-react";
import { EvidenceCapture, type EvidenceDraft } from "./EvidenceCapture";
import { EvidencePhotos } from "./EvidencePhotos";
import { EvidencePlayer } from "./EvidencePlayer";
import { EVIDENCE_ZONES, evidenceLabels, zoneLabels, type EvidenceView, type EvidenceZoneName } from "@/lib/evidence/constants";

async function api(path: string, body?: unknown) {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", cache: "no-store",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "No fue posible completar la operación.");
  return result;
}
export function EvidencePanel({ washId, onBusyChange, onStatusChange, showHeading = true }: { washId: number; onBusyChange?: (busy: boolean) => void; onStatusChange?: (status: EvidenceView["status"]) => void; showHeading?: boolean }) {
  const [data, setData] = useState<EvidenceView | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<EvidenceZoneName, EvidenceDraft>>>({});
  const [busy, setBusy] = useState(false);
  const [recordingZone, setRecordingZone] = useState<EvidenceZoneName | null>(null);
  const [progress, setProgress] = useState("");
  const [transfer, setTransfer] = useState<{ zone: EvidenceZoneName; percent: number | null; position: number; total: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [expanded, setExpanded] = useState<Partial<Record<EvidenceZoneName, boolean>>>({});
  const lock = useRef(false);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const mounted = useRef(true);
  const base = `/api/washes/${washId}/evidence`;
  const refresh = useCallback(async () => {
    try { const result = await api(base); if (mounted.current) setData(result); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "No se pudo consultar la evidencia."); }
  }, [base]);
  useEffect(() => {
    mounted.current = true; void refresh(); const timer = setInterval(() => void refresh(), 5000);
    return () => { mounted.current = false; clearInterval(timer); xhr.current?.abort(); };
  }, [refresh]);
  useEffect(() => { if (data) onStatusChange?.(data.status); }, [data, onStatusChange]);
  useEffect(() => { onBusyChange?.(busy || recordingZone !== null); }, [busy, recordingZone, onBusyChange]);
  useEffect(() => {
    if (!busy && !recordingZone && !Object.keys(drafts).length) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", prevent); return () => window.removeEventListener("beforeunload", prevent);
  }, [busy, recordingZone, drafts]);
  function uploadFile(url: string, draft: EvidenceDraft, type: string, zone: EvidenceZoneName) {
    return new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest(); xhr.current = request;
      request.open("PUT", url); request.timeout = 240000; request.setRequestHeader("Content-Type", type);
      request.upload.onprogress = event => {
        if (event.lengthComputable && mounted.current) {
          const percent = Math.round(event.loaded * 100 / event.total);
          setProgress(`Subiendo video ${zoneLabels[zone].toLowerCase()}`);
          setTransfer(current => current ? { ...current, percent } : null);
        }
      };
      request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("La subida falló. Conserva el video y reintenta."));
      request.onerror = () => reject(new Error("No se pudo conectar con el almacenamiento de videos. Revisa la conexión y que R2 permita subidas desde este sitio (CORS). El video seleccionado se conserva para reintentar."));
      request.ontimeout = () => reject(new Error("La subida tardó demasiado. Reintenta con mejor conexión; el video seleccionado se conserva."));
      request.onabort = () => reject(new Error("La subida se canceló. Reintenta con el video seleccionado."));
      request.send(draft.file);
    });
  }
  async function upload() {
    if (lock.current || !data?.enabled) return; lock.current = true; setBusy(true); setError("");
    try {
      const selectedZones = EVIDENCE_ZONES.filter(zone => drafts[zone]);
      for (const [index, zone] of selectedZones.entries()) {
        const draft = drafts[zone]; if (!draft) continue;
        setProgress(`Preparando ${zoneLabels[zone].toLowerCase()}…`);
        setTransfer({ zone, percent: null, position: index + 1, total: selectedZones.length });
        const started = await api(base, { zone, requestKey: draft.requestKey, contentType: draft.file.type.split(";")[0], byteSize: draft.file.size, note: draft.note });
        if (mounted.current) setDrafts(current => ({ ...current, [zone]: { ...draft, videoId: started.id } }));
        if (["FAILED", "EXPIRED", "SUPERSEDED"].includes(started.status)) throw new Error("Esta carga ya terminó sin aceptar el video. Prepara un nuevo intento con el archivo seleccionado.");
        if (started.uploadUrl) await uploadFile(started.uploadUrl, draft, started.contentType, zone);
        if (mounted.current) setProgress(`Confirmando video ${zoneLabels[zone].toLowerCase()}…`);
        const completed = await api(`${base}/${started.id}/complete`, {});
        if (["FAILED", "EXPIRED", "SUPERSEDED"].includes(completed.status)) throw new Error("El video no pudo aceptarse. Prepara un nuevo intento con el archivo seleccionado.");
        if (mounted.current) setDrafts(current => { const next = { ...current }; delete next[zone]; return next; });
      }
      if (mounted.current) setProgress("Videos listos para su consulta.");
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "No fue posible subir el video."); }
    finally { lock.current = false; if (mounted.current) { setBusy(false); setTransfer(null); await refresh(); } }
  }
  async function share(action: "create" | "revoke" | "rotate") {
    setSharing(true); setCopied(false); setError("");
    try { await api(`${base}/share`, { action }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "No fue posible actualizar el enlace."); }
    finally { setSharing(false); }
  }
  async function verifyPending() {
    if (lock.current || !data) return;
    lock.current = true; setBusy(true); setError(""); setProgress("Verificando videos subidos…");
    try {
      for (const video of data.videos.filter(v => ["QUEUED", "PROCESSING"].includes(v.status))) {
        await api(`${base}/${video.id}/complete`, {});
      }
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo verificar el video."); }
    finally { lock.current = false; setBusy(false); await refresh(); }
  }
  if (!data) return <section className="evidence-panel evidence-loading" aria-busy={!error}>
    {!error && <LoaderCircle className="evidence-spinner" size={22} aria-hidden="true"/>}
    <p role={error ? "alert" : "status"}>{error || "Consultando evidencia…"}</p>
    {error && <button type="button" className="secondary-button" onClick={() => void refresh()}>Reintentar</button>}
  </section>;
  const shareUrl = data.sharePath && typeof window !== "undefined" ? `${window.location.origin}${data.sharePath}` : null;
  const shareText = shareUrl ? `Turbo Wash · Evidencia de recepción del servicio #${washId}\nConsulta los videos, las fotos seleccionadas y su fecha de vencimiento aquí:\n${shareUrl}` : null;
  const processing = data.videos.some(video => ["QUEUED", "PROCESSING"].includes(video.status));
  const readyCount = data.videos.filter(video => video.status === "READY").length;
  async function copyLink() {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); }
    catch { setError("No se pudo copiar el enlace. Puedes abrir la página del cliente o compartir por WhatsApp."); }
  }
  return <section className="evidence-panel">
    {showHeading && <div className="evidence-heading"><h3><Video size={20}/>Evidencia de recepción</h3><span className={`evidence-badge evidence-${(busy ? "UPLOADING" : data.status).toLowerCase()}`}>{(busy || processing) && <LoaderCircle className="evidence-spinner" size={13} aria-hidden="true"/>}{evidenceLabels[busy ? "UPLOADING" : data.status]}</span></div>}
    <p className="evidence-description">Dos videos con audio · Hasta 45 segundos y 25 MB cada uno.</p>
    {!data.enabled && <p>La captura está deshabilitada temporalmente. Puedes consultar los videos vigentes.</p>}
    <div className="evidence-grid">{EVIDENCE_ZONES.map(zone => {
      const saved = data.videos.find(v => v.zone === zone);
      const canEdit = data.canUpload && (!saved || saved.canReplace) && (!saved || ["FAILED", "EXPIRED", "READY"].includes(saved.status) || (saved.status === "UPLOADING" && Boolean(drafts[zone])));
      return <section className="evidence-zone" key={zone}>
        <h4>{zoneLabels[zone]} <span className="evidence-zone-status">{saved && ["QUEUED", "PROCESSING"].includes(saved.status) && <LoaderCircle className="evidence-spinner" size={13} aria-hidden="true"/>}{saved?.status === "READY" && <CheckCircle2 size={14} aria-hidden="true"/>}{saved ? evidenceLabels[saved.status] : "Pendiente"}</span></h4>
        <p className="evidence-guide">{zone === "INTERIOR" ? "Asientos, alfombras, cielo y tablero." : "Recorrido alrededor del vehículo y detalles de la carrocería."}</p>
        {saved?.status === "READY" && <EvidencePlayer label={zoneLabels[zone]} endpoint={`${base}/${saved.id}/play`} />}
        {saved?.note && <p className="evidence-note">{saved.note}</p>}
        {saved?.expiresAt && <small className="evidence-expiry">Vence {new Date(saved.expiresAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" })}</small>}
        {saved?.error && <p className="evidence-error">{saved.error}</p>}
        {canEdit && saved?.status === "READY" && !expanded[zone] && <button type="button" className="secondary-button" disabled={busy} onClick={() => setExpanded(current => ({ ...current, [zone]: true }))}>Sustituir video</button>}
        {canEdit && (saved?.status !== "READY" || expanded[zone]) && <EvidenceCapture label={zoneLabels[zone]} disabled={busy || (recordingZone !== null && recordingZone !== zone)}
          draft={drafts[zone] ?? null} onRecording={value => setRecordingZone(value ? zone : null)}
          onChange={draft => { setError(""); setDrafts(current => { const next = { ...current }; if (draft) next[zone] = draft; else delete next[zone]; return next; }); }} />}
      </section>;
    })}</div>
    {(busy || processing) && <div className="evidence-progress" role="status" aria-live="polite">
      <div className="evidence-progress-heading"><LoaderCircle className="evidence-spinner" size={18} aria-hidden="true"/>
        <strong>{busy ? progress || "Preparando subida…" : "Videos subidos pendientes de verificación"}</strong>
        {busy && transfer?.percent !== null && transfer?.percent !== undefined && <span>{transfer.percent}%</span>}
      </div>
      {busy ? <><div className={`evidence-progress-track${transfer?.percent == null ? " evidence-progress-indeterminate" : ""}`} role="progressbar" aria-label="Progreso de subida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={transfer?.percent ?? undefined} aria-valuetext={progress}>
        <span style={transfer?.percent == null ? undefined : { width: `${transfer.percent}%` }}/>
      </div><small>{transfer ? `Video ${transfer.position} de ${transfer.total} · Mantén esta pantalla abierta durante la subida.` : "Mantén esta pantalla abierta mientras verificamos los videos."}</small></> : <>
        <div className="evidence-progress-track evidence-progress-indeterminate" aria-hidden="true"><span/></div>
        <small>{readyCount} de 2 videos listos. Verifica los originales para habilitar su consulta sin conversión.</small>
        {data.canVerify && <button type="button" className="secondary-button" onClick={() => void verifyPending()}>Verificar videos subidos</button>}
      </>}
    </div>}
    {(Object.keys(drafts).length > 0 || error) && <div className="evidence-upload-actions">
    {Object.keys(drafts).length > 0 && <><p>Revisa los videos y las observaciones antes de confirmar.</p><button type="button" className="primary-button" disabled={busy || Boolean(recordingZone) || !data.enabled} onClick={() => void upload()}><Upload size={18}/>{busy ? "Subiendo…" : error ? "Reintentar subida" : "Confirmar y subir videos"}</button></>}
    {error && data.videos.some(v => ["FAILED", "EXPIRED", "SUPERSEDED"].includes(v.status) && drafts[v.zone]) && <button type="button" className="secondary-button" disabled={busy} onClick={() => { setDrafts(current => Object.fromEntries(Object.entries(current).map(([zone, draft]) => [zone, { ...draft, requestKey: crypto.randomUUID(), videoId: undefined }]))); setError(""); }}>Preparar un nuevo intento con los mismos videos</button>}
    {error && <p role="alert" className="evidence-error">{error}</p>}
    </div>}
    <EvidencePhotos photos={data.photos} base={base} canEdit={data.canManagePhotos} refresh={refresh}/>
    <div className={`evidence-client-share${data.status === "READY" ? " evidence-client-share-ready" : ""}`}>
      <div className="evidence-client-heading">{data.status === "READY" ? <CheckCircle2 size={20}/> : <MessageCircle size={20}/>}<strong>{data.status === "READY" ? "Evidencia lista para el cliente" : "Enlace para el cliente"}</strong></div>
      <p>{data.revoked ? "El enlace fue revocado. Un administrador puede generar otro mientras los videos estén vigentes." : data.status === "READY" ? "Comparte un enlace con los videos, las fotos seleccionadas, las observaciones y sus fechas de vencimiento." : data.status === "EXPIRED" ? "La evidencia venció y ya no puede compartirse." : "Podrás compartir el enlace cuando los videos del interior y exterior estén listos."}</p>
      <div className="evidence-actions">
      {data.status === "READY" && !data.sharePath && !data.revoked && data.canUpload && <button type="button" className="primary-button" disabled={sharing || busy} onClick={() => void share("create")}>{sharing ? <LoaderCircle className="evidence-spinner" size={18}/> : <MessageCircle size={18}/>}Generar enlace para el cliente</button>}
      {shareText && <a className="primary-button" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><MessageCircle size={18}/>Compartir evidencia por WhatsApp</a>}
      {shareUrl && <><a className="secondary-button" href={data.sharePath!} target="_blank" rel="noreferrer"><ExternalLink size={16}/>Ver página del cliente</a><button type="button" className="secondary-button" onClick={() => void copyLink()}><Copy size={16}/>{copied ? "Enlace copiado" : "Copiar enlace"}</button></>}
      {data.canManageLink && data.sharePath && <button type="button" className="secondary-button" disabled={sharing} onClick={() => void share("revoke")}>Revocar enlace</button>}
      {data.canManageLink && data.status === "READY" && (data.revoked || data.sharePath) && <button type="button" className="secondary-button" disabled={sharing} onClick={() => void share("rotate")}><RefreshCw size={16}/>Generar otro enlace</button>}
      </div>
    </div>
    {data.canUpload && data.status !== "READY" && <small className="evidence-footnote">Conserva una copia en tu teléfono hasta confirmar la subida. Puedes completar la evidencia desde el historial.</small>}
  </section>;
}
export function EvidenceHistory({ washId, status }: { washId: number; status: keyof typeof evidenceLabels }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [liveStatus, setLiveStatus] = useState(status);
  useEffect(() => setLiveStatus(status), [status]);
  return <div className="record-evidence">
    <button type="button" className="evidence-toggle" disabled={busy} aria-label={`Evidencia de recepción: ${open ? "ocultar" : "mostrar"} videos`} aria-expanded={open} aria-controls={`evidence-${washId}`} onClick={() => setOpen(!open)}>
      <span className="evidence-toggle-title"><span className="evidence-toggle-icon"><Video size={18} aria-hidden="true"/></span><strong>Evidencia de recepción</strong></span>
      <span className={`evidence-badge evidence-${(busy ? "UPLOADING" : liveStatus).toLowerCase()}`}>{evidenceLabels[busy ? "UPLOADING" : liveStatus]}</span>
      {open ? <ChevronUp size={18} aria-hidden="true"/> : <ChevronDown size={18} aria-hidden="true"/>}
    </button>
    <div id={`evidence-${washId}`} hidden={!open}>{open && <EvidencePanel washId={washId} onBusyChange={setBusy} onStatusChange={setLiveStatus} showHeading={false}/>}</div>
  </div>;
}
