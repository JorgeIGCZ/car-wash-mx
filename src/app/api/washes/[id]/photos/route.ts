import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth";
import { deleteR2Object, uploadR2Object } from "@/lib/r2";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_PHOTOS = 6;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_INPUT_PIXELS = 50_000_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const washId = Number((await params).id);
  if (!Number.isInteger(washId) || washId <= 0) {
    return NextResponse.json({ error: "Lavado no válido." }, { status: 400 });
  }

  const wash = await prisma.wash.findFirst({
    where: {
      id: washId,
      ...(user.role === "ADMIN" ? {} : { createdById: user.id }),
    },
    select: {
      id: true,
      _count: { select: { photos: true } },
    },
  });

  if (!wash) {
    return NextResponse.json({ error: "Lavado no encontrado." }, { status: 404 });
  }

  if (wash._count.photos >= MAX_PHOTOS) {
    return NextResponse.json(
      { error: `El lavado ya tiene ${MAX_PHOTOS} fotografías.` },
      { status: 409 },
    );
  }

  const formData = await request.formData();
  const photo = formData.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "Selecciona una fotografía." }, { status: 400 });
  }

  if (photo.size <= 0 || photo.size > MAX_INPUT_BYTES) {
    return NextResponse.json(
      { error: "La fotografía debe pesar menos de 15 MB." },
      { status: 413 },
    );
  }

  let optimized: Buffer;
  let width: number;
  let height: number;

  try {
    const result = await sharp(Buffer.from(await photo.arrayBuffer()), {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    optimized = result.data;
    width = result.info.width;
    height = result.info.height;
  } catch {
    return NextResponse.json(
      { error: "El archivo no es una imagen compatible." },
      { status: 415 },
    );
  }

  const objectKey = `washes/${wash.id}/${randomUUID()}.webp`;

  try {
    await uploadR2Object(objectKey, optimized, "image/webp");
  } catch (error) {
    console.error("R2 upload failed", error);
    return NextResponse.json(
      { error: "No fue posible guardar la fotografía." },
      { status: 503 },
    );
  }

  try {
    const savedPhoto = await prisma.washPhoto.create({
      data: {
        washId: wash.id,
        objectKey,
        mimeType: "image/webp",
        byteSize: optimized.byteLength,
        width,
        height,
      },
    });

    return NextResponse.json(
      {
        id: savedPhoto.id,
        width: savedPhoto.width,
        height: savedPhoto.height,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Photo metadata save failed", error);
    await deleteR2Object(objectKey).catch(() => undefined);
    return NextResponse.json(
      { error: "No fue posible asociar la fotografía al lavado." },
      { status: 500 },
    );
  }
}
