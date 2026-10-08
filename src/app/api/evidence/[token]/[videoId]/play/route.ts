import { evidenceResponse } from "@/lib/evidence/http";
import { EvidenceError, playableVideo, publicEvidence } from "@/lib/evidence/service";
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; videoId: string }> }) {
  return evidenceResponse(async () => {
    const { token, videoId } = await params;
    const evidence = await publicEvidence(token);
    if (!evidence || !evidence.videos.some(v => v.id === videoId)) throw new EvidenceError(404, "Enlace no disponible.");
    return playableVideo(evidence.washId, videoId);
  });
}
