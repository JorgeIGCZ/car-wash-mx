import { evidenceResponse } from "@/lib/evidence/http";
import { EvidenceError, publicEvidence } from "@/lib/evidence/service";
import { photoResponse } from "@/lib/evidence/photos";
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  return evidenceResponse(async () => {
    const { token, photoId } = await params;
    const evidence = await publicEvidence(token);
    if (!evidence || !evidence.photos.some(photo => photo.id === Number(photoId))) throw new EvidenceError(404, "Foto no disponible.");
    return photoResponse(evidence.washId, Number(photoId), true);
  });
}
