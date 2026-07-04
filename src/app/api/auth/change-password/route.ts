import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteCurrentSession, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: z.string().min(10).max(100),
});

export async function POST(request: Request) {
  const user = await getCurrentUser({ allowPasswordChange: true });
  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "La nueva contraseña debe tener al menos 10 caracteres." },
      { status: 400 },
    );
  }

  if (!(await compare(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json(
      { error: "La contraseña actual es incorrecta." },
      { status: 400 },
    );
  }

  if (await compare(parsed.data.newPassword, user.passwordHash)) {
    return NextResponse.json(
      { error: "La nueva contraseña debe ser diferente a la actual." },
      { status: 400 },
    );
  }

  const passwordHash = await hash(parsed.data.newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await deleteCurrentSession();

  return NextResponse.json({ ok: true });
}
