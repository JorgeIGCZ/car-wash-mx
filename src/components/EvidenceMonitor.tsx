"use client";
import { useEffect, useState } from "react";
type Health = { enabled: boolean; oldestPendingAt: string | null; healthy: boolean; pending: number; failed: number; expiredAwaitingDeletion: number; worker: { lastCleanupAt: string | null; lastError: string | null } | null };
export function EvidenceMonitor() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let active = true;
    async function load() { try { const response = await fetch("/api/admin/evidence-status", {cache:"no-store"}); if (response.ok && active) setHealth(await response.json()); } catch { /* Next poll retries. */ } }
    void load(); const timer = setInterval(() => void load(), 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  if (!health || (!health.enabled && !health.worker && !health.pending && !health.failed && !health.expiredAwaitingDeletion)) return null;
  return <details className="evidence-monitor"><summary>Evidencias: {health.pending} procesando · {health.failed} con error{!health.healthy ? " · Procesador sin conexión" : ""}</summary>
    {health.oldestPendingAt && <p>Pendiente más antiguo: {new Date(health.oldestPendingAt).toLocaleString("es-MX", {timeZone:"America/Mexico_City"})}.</p>}
    <p>{health.expiredAwaitingDeletion} videos vencidos pendientes de eliminar.</p>
    <p>Última limpieza: {health.worker?.lastCleanupAt ? new Date(health.worker.lastCleanupAt).toLocaleString("es-MX", {timeZone:"America/Mexico_City"}) : "Sin ejecución registrada"}.</p>
    {health.worker?.lastError && <p>La limpieza encontró errores y volverá a intentarlo.</p>}
  </details>;
}
