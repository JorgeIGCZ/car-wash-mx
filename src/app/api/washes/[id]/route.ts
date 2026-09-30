import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdministration, getCurrentUser } from "@/lib/auth";
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
const updatePriceSchema = z.object({
  chargedPrice: z.number().positive().max(999999),
});

const updateDetailsSchema = z.object({
  serviceDate: z.string().date().refine((value) => value >= "1000-01-01", {
    message: "Selecciona una fecha válida.",
  }).optional(),
  paymentType: z.enum(["CASH", "CARD", "TRANSFER"]).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();

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

  if (!canAccessAdministration(user.role)) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const washId = Number((await params).id);
  if (!Number.isInteger(washId) || washId <= 0) {
    return NextResponse.json({ error: "Lavado no válido." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const isDetailsUpdate = body && ["serviceDate", "paymentType", "notes"].some(
    (field) => Object.prototype.hasOwnProperty.call(body, field),
  );

  if (!isDetailsUpdate && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const wash = await prisma.wash.findFirst({
    where: { id: washId, deletedAt: null },
    select: {
      id: true,
      chargedPrice: true,
      createdAt: true,
    },
  });

  if (!wash) {
    return NextResponse.json({ error: "Lavado no encontrado." }, { status: 404 });
  }

  if (isDetailsUpdate) {
    const parsed = updateDetailsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Revisa la fecha, la forma de pago y los comentarios (máximo 2000 caracteres)." },
        { status: 400 },
      );
    }

    const { serviceDate, paymentType, notes } = parsed.data;
    const createdAt = new Date(wash.createdAt);
    if (serviceDate) {
      const [year, month, day] = serviceDate.split("-").map(Number);
      // The server runs in America/Mexico_City; retain the service's local time.
      createdAt.setFullYear(year, month - 1, day);
    }
    const updated = await prisma.wash.updateMany({
      where: { id: wash.id, deletedAt: null },
      data: {
        ...(serviceDate !== undefined ? { createdAt } : {}),
        ...(paymentType !== undefined ? { paymentType } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
      },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Lavado no encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

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

  if (body && Object.prototype.hasOwnProperty.call(body, "chargedPrice")) {
    const parsedPrice = updatePriceSchema.safeParse(body);
    if (!parsedPrice.success) {
      return NextResponse.json(
        { error: "Captura una cantidad cobrada válida." },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedWash = await tx.wash.update({
        where: { id: wash.id },
        data: { chargedPrice: parsedPrice.data.chargedPrice },
        select: { id: true, chargedPrice: true },
      });
      const percentageCommissions = await tx.washCommission.findMany({
        where: { washId: wash.id, type: "PERCENTAGE" },
        select: { userId: true, value: true },
      });

      await Promise.all(
        percentageCommissions.map((commission) =>
          tx.washCommission.update({
            where: {
              washId_userId: {
                washId: wash.id,
                userId: commission.userId,
              },
            },
            data: {
              amount: calculateCommissionAmount(
                parsedPrice.data.chargedPrice,
                "PERCENTAGE",
                Number(commission.value),
              ),
            },
          }),
        ),
      );

      return updatedWash;
    });

    return NextResponse.json({
      ok: true,
      wash: {
        id: updated.id,
        chargedPrice: Number(updated.chargedPrice),
      },
    });
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
  const commissionUser = await prisma.user.findFirst({
    where: {
      id: parsed.data.userId,
      active: true,
      role: { in: ["ADMIN", "EMPLOYEE"] },
    },
    select: { id: true },
  });

  if (!commissionUser) {
    return NextResponse.json(
      { error: "Selecciona una persona activa para comisionar." },
      { status: 400 },
    );
  }

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
