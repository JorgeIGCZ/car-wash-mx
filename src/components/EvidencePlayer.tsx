"use client";
import { useRef, useState } from "react";
import { Play } from "lucide-react";
export function EvidencePlayer({ endpoint, label }: { endpoint: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const element = useRef<HTMLVideoElement>(null);
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Video no disponible.");
      setUrl(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : "No fue posible cargar el video."); }
    finally { setLoading(false); }
  }
  return <div className="evidence-player">
    {url && <video ref={element} src={url} controls playsInline preload="none" aria-label={label}
      onError={() => { setUrl(null); setError("El acceso temporal terminó o la conexión falló. Vuelve a cargar el video."); }} />}
    {!url && <button type="button" className="secondary-button" disabled={loading} onClick={() => void load()}><Play size={18} />{loading ? "Cargando…" : `Cargar video ${label.toLowerCase()}`}</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
