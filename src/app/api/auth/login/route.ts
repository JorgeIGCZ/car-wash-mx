import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de acceso inválidos." }, { status: 400 });
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
  } catch {
    return NextResponse.json(
      { error: "No fue posible conectar con la base de datos." },
      { status: 503 },
    );
  }

  if (!user || !user.active || !(await compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }

  try {
    await createSession(user.id);
  } catch {
    return NextResponse.json(
      { error: "No fue posible crear la sesión." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    mustChangePassword: user.mustChangePassword,
  });
}
