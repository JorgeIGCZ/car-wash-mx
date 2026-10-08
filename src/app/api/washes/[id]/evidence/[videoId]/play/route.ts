import { evidenceResponse, evidenceUser } from "@/lib/evidence/http";
import { evidenceWash, playableVideo } from "@/lib/evidence/service";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; videoId: string }> }) {
  return evidenceResponse(async () => { const { id, videoId } = await params; await evidenceWash(Number(id), await evidenceUser()); return playableVideo(Number(id), videoId); });
}
