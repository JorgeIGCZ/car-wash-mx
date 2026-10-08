import type { Metadata } from "next";
import Image from "next/image";
import { EvidencePublicPhotos } from "@/components/EvidencePublicPhotos";
import { EvidencePlayer } from "@/components/EvidencePlayer";
import { publicEvidence } from "@/lib/evidence/service";
import { zoneLabels } from "@/lib/evidence/constants";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Evidencia de recepción | Turbo Wash",
  description: "Consulta los videos y fotos del estado de tu vehículo al recibirlo en Turbo Wash.",
  manifest: null, appleWebApp: null, applicationName: null,
  robots: { index: false, follow: false, noarchive: true }, referrer: "no-referrer",
};
export default async function EvidencePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const evidence = await publicEvidence(token);
  return <main className="public-evidence">
    <Image src="/turbo-wash-logo.png" alt="Turbo Wash" width={170} height={100} style={{objectFit:"contain"}} />
    <h1>Evidencia de recepción</h1>
    {!evidence ? <p>Este enlace ya no está disponible. Comunícate con Turbo Wash si necesitas ayuda.</p> : <>
      <p>Servicio #{evidence.washId} · {evidence.vehicle}</p><h2>{evidence.service}</h2>
      <p>Registro del estado del vehículo al recibirlo.</p>
      {evidence.videos.map(video => <section className="evidence-zone" key={video.id}>
        <h2>{zoneLabels[video.zone]}</h2>
        {video.status === "READY" ? <EvidencePlayer label={zoneLabels[video.zone]} endpoint={`/api/evidence/${token}/${video.id}/play`} /> : <p>{video.status === "EXPIRED" ? "Evidencia vencida. El video ya no está disponible." : "Evidencia pendiente."}</p>}
        {video.note && <p className="evidence-note">{video.note}</p>}
        {video.expiresAt && <small>Disponible hasta: {new Date(video.expiresAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" })} (hora de Ciudad de México).</small>}
      </section>)}
      {evidence.photos.length > 0 && <EvidencePublicPhotos photos={evidence.photos} token={token}/>}
    </>}
  </main>;
}
