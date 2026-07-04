import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const category = z.enum(["NORMAL", "INTERIOR", "SPECIAL"]);
const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category,
  description: z.string().trim().max(255).optional().nullable(),
  requiresCustomPrice: z.boolean().default(false),
  requiresDescription: z.boolean().default(false),
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

async function admin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN";
}

export async function POST(request: Request) {
  if (!(await admin())) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos del paquete inválidos." }, { status: 400 });
  }

  const categoryCount = await prisma.servicePackage.count({
    where: { category: parsed.data.category },
  });
  const baseSlug = slugify(parsed.data.name);
  const existing = await prisma.servicePackage.findUnique({ where: { slug: baseSlug } });
  const item = await prisma.servicePackage.create({
    data: {
      ...parsed.data,
      description: parsed.data.description || null,
      slug: existing ? `${baseSlug}-${Date.now()}` : baseSlug,
      sortOrder: categoryCount + 1,
    },
  });
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await admin())) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos del paquete inválidos." }, { status: 400 });
  }

  const { id, ...data } = parsed.data;
  const item = await prisma.servicePackage.update({
    where: { id },
    data: {
      ...data,
      description: data.description === "" ? null : data.description,
    },
  });
  return NextResponse.json(item);
}
