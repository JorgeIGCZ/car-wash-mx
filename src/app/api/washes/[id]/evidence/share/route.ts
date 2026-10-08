import { evidenceResponse, evidenceUser } from "@/lib/evidence/http";
import { manageShare } from "@/lib/evidence/service";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return evidenceResponse(async () => manageShare(Number((await params).id), await evidenceUser(), (await request.json().catch(() => ({}))).action));
}
