import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  canAccessAdministration,
  getCurrentUser,
} from "@/lib/auth";
import { localDayRange } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getWorkWeekRange, getWorkWeekSettings } from "@/lib/work-week";

const expenseBaseSchema = z.object({
  expenseDate: z.string().trim().min(1),
  concept: z.string().trim().min(2).max(160),
  amount: z.coerce.number().positive().max(999999),
  notes: z.string().trim().max(2000).optional().nullable(),
  takenFromCash: z.boolean().default(false),
  reimbursable: z.boolean().default(false),
  partnerId: z.number().int().positive().optional().nullable(),
});

const expenseFieldsSchema = expenseBaseSchema.superRefine((data, context) => {
  const expenseDate = new Date(`${data.expenseDate}T00:00:00`);
  if (Number.isNaN(expenseDate.valueOf())) {
    context.addIssue({
      code: "custom",
      path: ["expenseDate"],
      message: "Selecciona una fecha válida.",
    });
  }
  if (data.takenFromCash && data.reimbursable) {
    context.addIssue({
      code: "custom",
      path: ["reimbursable"],
      message: "Un egreso tomado de caja no puede generar reembolso.",
    });
  }
});

const updateExpenseSchema = expenseBaseSchema.partial().extend({
  id: z.number().int().positive(),
});
const deleteExpenseSchema = z.object({
  id: z.number().int().positive(),
});

async function getPeriodRange(period: string, from: string | null, to: string | null) {
  const now = new Date();
  const today = localDayRange(now);

  if (period === "WEEK") {
    const settings = await getWorkWeekSettings();
    return getWorkWeekRange(now, settings.startDay, settings.endDay);
  }

  if (period === "MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: today.end };
  }

  if (period === "RANGE" && from && to) {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    if (!Number.isNaN(start.valueOf()) && !Number.isNaN(end.valueOf())) {
      return { start, end };
    }
  }

  return today;
}

function serializeExpense<T extends {
  amount: Prisma.Decimal;
  partner: { id: number; name: string } | null;
  createdBy: { id: number; name: string };
}>(expense: T) {
  return {
    ...expense,
    amount: Number(expense.amount),
  };
}

async function currentAdmin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? user : null;
}

async function currentExpenseCreator() {
  const user = await getCurrentUser();
  return user && canAccessAdministration(user.role) ? user : null;
}

async function validatePartner(partnerId?: number | null) {
  if (!partnerId) return true;

  const partner = await prisma.user.findFirst({
    where: {
      id: partnerId,
      active: true,
      role: "ADMIN",
      isPartner: true,
    },
    select: { id: true },
  });

  return Boolean(partner);
}

function resolvePartnerId({
  user,
  reimbursable,
  partnerId,
}: {
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  reimbursable: boolean;
  partnerId?: number | null;
}) {
  if (!reimbursable) return null;
  if (user?.role === "ADMIN" && user.isPartner) return user.id;
  return partnerId ?? null;
}

function toExpenseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canAccessAdministration(user.role)) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const period = request.nextUrl.searchParams.get("period") ?? "TODAY";
  const range = await getPeriodRange(
    period,
    request.nextUrl.searchParams.get("from"),
    request.nextUrl.searchParams.get("to"),
  );
  const where = { expenseDate: { gte: range.start, lt: range.end } };
  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        partner: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.expense.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  return NextResponse.json({
    expenses: expenses.map(serializeExpense),
    stats: {
      total: Number(total._sum.amount ?? 0),
    },
    range: {
      start: range.start,
      end: range.end,
    },
  });
}

export async function POST(request: Request) {
  const user = await currentExpenseCreator();
  if (!user) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const parsed = expenseFieldsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos de egreso inválidos." },
      { status: 400 },
    );
  }
  const partnerId = resolvePartnerId({
    user,
    reimbursable: parsed.data.reimbursable,
    partnerId: parsed.data.partnerId,
  });
  if (parsed.data.reimbursable && !partnerId) {
    return NextResponse.json(
      { error: "Selecciona el socio a reembolsar." },
      { status: 400 },
    );
  }
  if (!(await validatePartner(partnerId))) {
    return NextResponse.json(
      { error: "Selecciona un socio activo." },
      { status: 400 },
    );
  }

  const expense = await prisma.expense.create({
    data: {
      expenseDate: toExpenseDate(parsed.data.expenseDate),
      concept: parsed.data.concept,
      amount: parsed.data.amount,
      notes: parsed.data.notes || null,
      takenFromCash: parsed.data.takenFromCash,
      reimbursable: parsed.data.reimbursable,
      partnerId,
      createdById: user.id,
    },
    include: {
      partner: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(serializeExpense(expense), { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await currentAdmin();
  if (!user) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const parsed = updateExpenseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos de egreso inválidos." },
      { status: 400 },
    );
  }
  const current = await prisma.expense.findUnique({
    where: { id: parsed.data.id },
    select: {
      expenseDate: true,
      concept: true,
      amount: true,
      notes: true,
      takenFromCash: true,
      reimbursable: true,
      partnerId: true,
    },
  });
  if (!current) {
    return NextResponse.json(
      { error: "El egreso no existe." },
      { status: 404 },
    );
  }

  const nextExpense = {
    expenseDate:
      parsed.data.expenseDate ??
      current.expenseDate.toISOString().slice(0, 10),
    concept: parsed.data.concept ?? current.concept,
    amount:
      parsed.data.amount === undefined
        ? Number(current.amount)
        : parsed.data.amount,
    notes: parsed.data.notes === undefined ? current.notes : parsed.data.notes,
    takenFromCash: parsed.data.takenFromCash ?? current.takenFromCash,
    reimbursable: parsed.data.reimbursable ?? current.reimbursable,
    partnerId:
      parsed.data.partnerId === undefined ? current.partnerId : parsed.data.partnerId,
  };
  const nextParsed = expenseFieldsSchema.safeParse(nextExpense);
  if (!nextParsed.success) {
    return NextResponse.json(
      { error: nextParsed.error.issues[0]?.message ?? "Datos de egreso inválidos." },
      { status: 400 },
    );
  }
  const partnerId = resolvePartnerId({
    user,
    reimbursable: nextParsed.data.reimbursable,
    partnerId: nextParsed.data.partnerId,
  });
  if (nextParsed.data.reimbursable && !partnerId) {
    return NextResponse.json(
      { error: "Selecciona el socio a reembolsar." },
      { status: 400 },
    );
  }
  if (!(await validatePartner(partnerId))) {
    return NextResponse.json(
      { error: "Selecciona un socio activo." },
      { status: 400 },
    );
  }

  const expense = await prisma.expense.update({
    where: { id: parsed.data.id },
    data: {
      expenseDate: toExpenseDate(nextParsed.data.expenseDate),
      concept: nextParsed.data.concept,
      amount: nextParsed.data.amount,
      notes: nextParsed.data.notes || null,
      takenFromCash: nextParsed.data.takenFromCash,
      reimbursable: nextParsed.data.reimbursable,
      partnerId,
    },
    include: {
      partner: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(serializeExpense(expense));
}

export async function DELETE(request: Request) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const parsed = deleteExpenseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Egreso inválido." }, { status: 400 });
  }

  await prisma.expense.delete({ where: { id: parsed.data.id } });

  return new NextResponse(null, { status: 204 });
}
