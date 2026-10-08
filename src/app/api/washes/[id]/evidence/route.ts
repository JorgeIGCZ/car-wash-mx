import { evidenceResponse, evidenceUser } from "@/lib/evidence/http";
import { beginUpload, evidenceView } from "@/lib/evidence/service";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  return evidenceResponse(async () => evidenceView(Number((await params).id), await evidenceUser()));
}
export async function POST(request: Request, { params }: Context) {
  return evidenceResponse(async () => beginUpload(Number((await params).id), await evidenceUser(), await request.json().catch(() => null)));
}
