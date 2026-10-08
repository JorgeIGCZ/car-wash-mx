import { evidenceResponse, evidenceUser } from "@/lib/evidence/http";
import { evidenceWash, updatePhotoVisibility } from "@/lib/evidence/service";
import { photoResponse } from "@/lib/evidence/photos";
type Context = { params: Promise<{ id: string; photoId: string }> };
export async function GET(_request: Request, { params }: Context) {
  return evidenceResponse(async () => {
    const user = await evidenceUser(); const { id, photoId } = await params;
    await evidenceWash(Number(id), user);
    return photoResponse(Number(id), Number(photoId), false);
  });
}
export async function PATCH(request: Request, { params }: Context) {
  return evidenceResponse(async () => {
    const user = await evidenceUser(); const { id, photoId } = await params;
    return updatePhotoVisibility(Number(id), Number(photoId), user, await request.json().catch(() => null));
  });
}
