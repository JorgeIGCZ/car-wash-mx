import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  requiresCustom: z.boolean().default(false),
});
const updateSchema = createSchema.partial().extend({
  id: z.number().int().positive(),
  active: z.boolean().optional(),
});

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function isAdmin() {
  return (await getCurrentUser())?.role === "ADMIN";
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const count = await prisma.vehicleType.count();
  const baseSlug = slugify(parsed.data.name);
  const existing = await prisma.vehicleType.findUnique({ where: { slug: baseSlug } });
  const item = await prisma.vehicleType.create({
    data: {
      ...parsed.data,
      slug: existing ? `${baseSlug}-${Date.now()}` : baseSlug,
      sortOrder: count + 1,
    },
  });
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const { id, ...data } = parsed.data;
  const item = await prisma.vehicleType.update({ where: { id }, data });
  return NextResponse.json(item);
}
