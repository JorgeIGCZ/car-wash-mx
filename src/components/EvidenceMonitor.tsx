"use client";
import { useEffect, useState } from "react";
type Health = { enabled: boolean; oldestPendingAt: string | null; healthy: boolean; pending: number; failed: number; expiredAwaitingDeletion: number; worker: { lastCleanupAt: string | null; lastError: string | null } | null };
export function EvidenceMonitor() {
  const [health, setHealth] = useState<Health | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState("");
  async function clean() {
    setCleaning(true); setError("");
    try {
      const response = await fetch("/api/admin/evidence-cleanup", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo ejecutar la limpieza.");
      if (result.failures) setError("Algunos archivos no pudieron eliminarse. Se reintentará en la siguiente limpieza.");
      const status = await fetch("/api/admin/evidence-status", { cache: "no-store" });
      if (status.ok) setHealth(await status.json());
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo ejecutar la limpieza."); }
    finally { setCleaning(false); }
  }
  useEffect(() => {
    let active = true;
    async function load() { try { const response = await fetch("/api/admin/evidence-status", {cache:"no-store"}); if (response.ok && active) setHealth(await response.json()); } catch { /* Next poll retries. */ } }
    void load(); const timer = setInterval(() => void load(), 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  if (!health || (!health.enabled && !health.worker && !health.pending && !health.failed && !health.expiredAwaitingDeletion)) return null;
  return <details className="evidence-monitor"><summary>Evidencias: {health.pending} por verificar · {health.failed} con error{!health.healthy ? " · Limpieza pendiente" : ""}</summary>
    {health.oldestPendingAt && <p>Pendiente más antiguo: {new Date(health.oldestPendingAt).toLocaleString("es-MX", {timeZone:"America/Mexico_City"})}.</p>}
    <p>{health.expiredAwaitingDeletion} videos vencidos pendientes de eliminar.</p>
    <p>Última limpieza: {health.worker?.lastCleanupAt ? new Date(health.worker.lastCleanupAt).toLocaleString("es-MX", {timeZone:"America/Mexico_City"}) : "Sin ejecución registrada"}.</p>
    {health.worker?.lastError && <p>La limpieza encontró errores y volverá a intentarlo.</p>}
    <p>Videos originales, sin conversión. Programa la limpieza cada 15 minutos.</p>
    <button type="button" className="secondary-button" disabled={cleaning} onClick={() => void clean()}>{cleaning ? "Limpiando…" : "Ejecutar limpieza"}</button>
    {error && <p role="alert">{error}</p>}
  </details>;
}
