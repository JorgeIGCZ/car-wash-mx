"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ImageIcon, LoaderCircle } from "lucide-react";
import type { EvidencePhotoView } from "@/lib/evidence/constants";

function PhotoCard({ photo, base, canEdit, refresh }: { photo: EvidencePhotoView; base: string; canEdit: boolean; refresh: () => Promise<void> }) {
  const [visible, setVisible] = useState(photo.clientVisible);
  const [note, setNote] = useState(photo.clientNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => { setVisible(photo.clientVisible); setNote(photo.clientNote ?? ""); }, [photo.clientVisible, photo.clientNote]);
  const changed = visible !== photo.clientVisible || note !== (photo.clientNote ?? "");
  async function save() {
    if (lock.current) return; lock.current = true; setSaving(true); setError("");
    try {
      const response = await fetch(`${base}/photos/${photo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientVisible: visible, clientNote: note }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar la foto.");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); }
    finally { lock.current = false; setSaving(false); }
  }
  return <section className="evidence-photo-card">
    {/* Authenticated, uncached image route; never use Next's shared image cache. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`${base}/photos/${photo.id}`} alt="Foto del servicio" loading="lazy" />
    <label className="evidence-photo-choice"><input type="checkbox" checked={visible} disabled={!canEdit || saving || (photo.expired && !visible)} onChange={event => setVisible(event.target.checked)}/>Visible para el cliente</label>
    <small>{photo.expired ? "Disponibilidad para el cliente vencida. La foto se conserva internamente." : `Disponible hasta ${new Date(photo.expiresAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" })}`}</small>
    {canEdit ? <><label className="evidence-photo-note">Observación visible para el cliente<textarea value={note} maxLength={1000} disabled={saving} placeholder="Por ejemplo: raspón en la puerta derecha" onChange={event => setNote(event.target.value)}/></label>
      {changed && <button type="button" className="secondary-button" disabled={saving} onClick={() => void save()}>{saving ? <LoaderCircle size={16} className="evidence-spinner"/> : <Check size={16}/>} {saving ? "Guardando…" : "Guardar cambios"}</button>}</> : photo.clientNote && <p>{photo.clientNote}</p>}
    {error && <p className="evidence-error" role="alert">{error}</p>}
  </section>;
}
export function EvidencePhotos({ photos, base, canEdit, refresh }: { photos: EvidencePhotoView[]; base: string; canEdit: boolean; refresh: () => Promise<void> }) {
  return <div className="evidence-photos"><h4><ImageIcon size={20}/>Fotos para el cliente</h4>
    <p>{canEdit ? "Selecciona entre las fotos del servicio. Solo las marcadas y guardadas aparecerán en el enlace; las demás siguen siendo internas." : "El cliente solo puede ver las fotos marcadas y vigentes. Las demás siguen siendo internas."}</p>
    {photos.length ? <div className="evidence-photo-grid">{photos.map(photo => <PhotoCard key={photo.id} photo={photo} base={base} canEdit={canEdit} refresh={refresh}/>)}</div> : <p className="evidence-footnote">Este servicio no tiene fotos guardadas.</p>}
  </div>;
}
