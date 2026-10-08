import { evidenceResponse, evidenceUser } from "@/lib/evidence/http";
import { completeUpload } from "@/lib/evidence/service";
export async function POST(_request: Request, { params }: { params: Promise<{ id: string; videoId: string }> }) {
  return evidenceResponse(async () => { const { id, videoId } = await params; return completeUpload(Number(id), videoId, await evidenceUser()); });
}
