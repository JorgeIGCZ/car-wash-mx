import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(10).max(100),
  role: z.enum(["ADMIN", "EMPLOYEE"]).default("EMPLOYEE"),
});
const updateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(["ADMIN", "EMPLOYEE"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(10).max(100).optional(),
});

async function currentAdmin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? user : null;
}

export async function GET() {
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      mustChangePassword: true,
      _count: { select: { washesCreated: true, washParticipations: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisa nombre, correo y contraseña." }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (exists) {
    return NextResponse.json({ error: "El correo ya está registrado." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      passwordHash: await hash(parsed.data.password, 12),
      mustChangePassword: true,
    },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return NextResponse.json(user, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de usuario inválidos." }, { status: 400 });
  }
  if (
    parsed.data.id === admin.id &&
    (parsed.data.active === false || parsed.data.password)
  ) {
    return NextResponse.json(
      { error: "Usa tu perfil para cambiar tu propia contraseña." },
      { status: 400 },
    );
  }

  const { id, password, ...data } = parsed.data;
  const passwordHash = password ? await hash(password, 12) : null;
  const user = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.update({
      where: { id },
      data: {
        ...data,
        ...(passwordHash
          ? {
              passwordHash,
              mustChangePassword: true,
              passwordChangedAt: null,
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        mustChangePassword: true,
      },
    });
    if (passwordHash) {
      await transaction.session.deleteMany({ where: { userId: id } });
    }
    return updated;
  });
  return NextResponse.json(user);
}
