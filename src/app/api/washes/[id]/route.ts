import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateCommissionSchema = z
  .object({
    userId: z.number().int().positive(),
    type: z.enum(["PERCENTAGE", "FIXED"]),
    value: z.number().min(0).max(999999),
  })
  .superRefine((data, context) => {
    if (data.type === "PERCENTAGE" && data.value > 100) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "El porcentaje no puede ser mayor a 100.",
      });
    }
  });

const assignSchema = z.object({ assignToId: z.number().int().positive() });

function calculateCommissionAmount(
  chargedPrice: number,
  type: "PERCENTAGE" | "FIXED",
  value: number,
) {
  return type === "PERCENTAGE"
    ? Math.round(chargedPrice * value) / 100
    : value;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const washId = Number((await params).id);
  if (!Number.isInteger(washId) || washId <= 0) {
    return NextResponse.json({ error: "Lavado no válido." }, { status: 400 });
  }

  // Load the wash first (used both for assign and commission paths)
  const wash = await prisma.wash.findFirst({
    where: { id: washId, deletedAt: null },
    select: {
      id: true,
      chargedPrice: true,
      createdById: true,
      participants: { select: { userId: true } },
    },
  });

  if (!wash) {
    return NextResponse.json({ error: "Lavado no encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  // Assigning a different user to the service
  if (body && Object.prototype.hasOwnProperty.call(body, "assignToId")) {
    const parsedAssign = assignSchema.safeParse(body);
    if (!parsedAssign.success) {
      return NextResponse.json({ error: "Usuario asignado inválido." }, { status: 400 });
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: parsedAssign.data.assignToId, active: true },
      select: { id: true, name: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "Usuario destino no válido." }, { status: 400 });
    }

    const updated = await prisma.wash.update({
      where: { id: wash.id },
      data: { createdById: targetUser.id },
      select: {
        id: true,
        createdById: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ ok: true, wash: updated });
  }

  // Otherwise treat as commission update
  const parsed = updateCommissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Comisión inválida." },
      { status: 400 },
    );
  }

  // Admins are allowed to set commissions; no longer restrict only to
  // participants/creator. This allows assigning commission to the new
  // responsible user even if they weren't previously listed as a worker.

  const amount = calculateCommissionAmount(
    Number(wash.chargedPrice),
    parsed.data.type,
    parsed.data.value,
  );

  const commission = await prisma.washCommission.upsert({
    where: {
      washId_userId: {
        washId: wash.id,
        userId: parsed.data.userId,
      },
    },
    update: {
      type: parsed.data.type,
      value: parsed.data.value,
      amount,
    },
    create: {
      washId: wash.id,
      userId: parsed.data.userId,
      type: parsed.data.type,
      value: parsed.data.value,
      amount,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    ...commission,
    value: Number(commission.value),
    amount: Number(commission.amount),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const washId = Number((await params).id);
  if (!Number.isInteger(washId) || washId <= 0) {
    return NextResponse.json({ error: "Lavado no válido." }, { status: 400 });
  }

  const wash = await prisma.wash.findFirst({
    where: { id: washId, deletedAt: null },
    select: { id: true },
  });

  if (!wash) {
    return NextResponse.json({ error: "Lavado no encontrado." }, { status: 404 });
  }

  await prisma.wash.update({
    where: { id: wash.id },
    data: {
      deletedAt: new Date(),
      deletedById: user.id,
    },
  });

  return new NextResponse(null, { status: 204 });
}
