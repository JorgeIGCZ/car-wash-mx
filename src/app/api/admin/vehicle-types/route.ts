import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

async function vehicleNameExists(name: string, exceptId?: number) {
  const normalizedName = slugify(name);
  const vehicles = await prisma.vehicleType.findMany({
    select: { id: true, name: true },
  });

  return vehicles.some((item) => {
    if (item.id === exceptId) return false;
    return slugify(item.name) === normalizedName;
  });
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
  if (!baseSlug) {
    return NextResponse.json({ error: "Usa letras o números en el nombre del vehículo." }, { status: 400 });
  }
  if (await vehicleNameExists(parsed.data.name)) {
    return NextResponse.json({ error: "Ya existe un vehículo con ese nombre." }, { status: 409 });
  }

  try {
    const item = await prisma.vehicleType.create({
      data: {
        ...parsed.data,
        slug: baseSlug,
        sortOrder: count + 1,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un vehículo con ese nombre." }, { status: 409 });
    }
    throw error;
  }
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
  if (data.name) {
    const baseSlug = slugify(data.name);
    if (!baseSlug) {
      return NextResponse.json({ error: "Usa letras o números en el nombre del vehículo." }, { status: 400 });
    }
    if (await vehicleNameExists(data.name, id)) {
      return NextResponse.json({ error: "Ya existe un vehículo con ese nombre." }, { status: 409 });
    }
  }

  const item = await prisma.vehicleType.update({ where: { id }, data });
  return NextResponse.json(item);
}
