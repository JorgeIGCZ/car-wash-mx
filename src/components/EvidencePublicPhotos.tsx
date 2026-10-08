"use client";
import { useState } from "react";
import { PhotoLightbox } from "./PhotoLightbox";
type PublicPhoto = { id: number; note: string | null; expiresAt: string; width: number; height: number };
export function EvidencePublicPhotos({ photos, token }: { photos: PublicPhoto[]; token: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const images = photos.map(photo => ({ ...photo, url: `/api/evidence/${token}/photos/${photo.id}` }));
  return <section className="evidence-public-photos"><h2>Fotos de recepción</h2>
    <div className="evidence-photo-grid">{images.map((photo, index) => <section className="evidence-photo-card" key={photo.id}>
      <button type="button" className="evidence-photo-preview" aria-label={`Ampliar foto ${index + 1}`} onClick={() => setSelected(index)}>
        {/* Uncached private route; do not use Next's shared image cache. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="Detalle del vehículo al recibirlo" loading="lazy" width={photo.width} height={photo.height}/>
        <span>Ampliar foto</span>
      </button>
      {photo.note && <p className="evidence-note">{photo.note}</p>}
      <small>Disponible hasta: {new Date(photo.expiresAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" })} (hora de Ciudad de México).</small>
    </section>)}</div>
    {selected !== null && <PhotoLightbox photos={images} startIndex={selected} title="Fotos de recepción" onClose={() => setSelected(null)}/>}
  </section>;
}
