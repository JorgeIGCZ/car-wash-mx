import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  canAccessAdministration,
  getCurrentUser,
} from "@/lib/auth";
import { localDayRange } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getR2ObjectUrl } from "@/lib/r2";
import { getWorkWeekRange, getWorkWeekSettings } from "@/lib/work-week";

const createWashSchema = z.object({
  vehicleTypeId: z.number().int().positive(),
  packageId: z.number().int().positive(),
  createdById: z.number().int().positive().optional(),
  plate: z.string().trim().max(32).optional().nullable(),
  customPrice: z.number().positive().max(999999).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  customServiceDescription: z.string().trim().max(2000).optional().nullable(),
  participantIds: z.array(z.number().int().positive()).max(20).default([]),
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

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const period = request.nextUrl.searchParams.get("period") ?? "TODAY";
  const range = await getPeriodRange(
    period,
    request.nextUrl.searchParams.get("from"),
    request.nextUrl.searchParams.get("to"),
  );
  const globalScope =
    request.nextUrl.searchParams.get("scope") === "all" &&
    canAccessAdministration(user.role);
  const requestedUserId = Number(request.nextUrl.searchParams.get("userId"));
  const hasRequestedUser =
    globalScope && Number.isInteger(requestedUserId) && requestedUserId > 0;
  const userFilter =
    hasRequestedUser
      ? {
          OR: [
            { createdById: requestedUserId },
            { participants: { some: { userId: requestedUserId } } },
          ],
        }
      : {};
  const visibility: Prisma.WashWhereInput = globalScope
    ? {}
    : {
        OR: [
          { createdById: user.id },
          { participants: { some: { userId: user.id } } },
        ],
      };
  const where: Prisma.WashWhereInput = {
    ...visibility,
    ...userFilter,
    createdAt: { gte: range.start, lt: range.end },
  };

  const [washes, total, commissionTotal, selectedCommissionTotal] =
    await Promise.all([
    prisma.wash.findMany({
      where,
      include: {
        vehicleType: { select: { name: true } },
        package: { select: { name: true, category: true } },
        createdBy: { select: { id: true, name: true } },
        participants: {
          include: { user: { select: { id: true, name: true } } },
        },
        commissions: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { user: { name: "asc" } },
        },
        photos: {
          select: {
            id: true,
            objectKey: true,
            width: true,
            height: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.wash.aggregate({
      where,
      _sum: { chargedPrice: true },
    }),
    prisma.washCommission.aggregate({
      where: { wash: where },
      _sum: { amount: true },
    }),
      prisma.washCommission.aggregate({
        where: {
          wash: where,
          ...(
            globalScope
              ? hasRequestedUser
                ? { userId: requestedUserId }
                : {}
              : { userId: user.id }
          ),
        },
        _sum: { amount: true },
      }),
    ]);

  const serializedWashes = await Promise.all(
    washes.map(async (wash) => {
      const {
        chargedPrice: rawChargedPrice,
        commissions: rawCommissions,
        photos,
        ...washDetails
      } = wash;
      const chargedPrice = Number(rawChargedPrice);
      const commissions = rawCommissions.map((commission) => ({
        ...commission,
        value: Number(commission.value),
        amount: Number(commission.amount),
      }));
      const totalCommission = commissions.reduce(
        (sum, commission) => sum + commission.amount,
        0,
      );
      const personalCommission =
        commissions.find((commission) => commission.user.id === user.id)?.amount ?? 0;

      return {
        ...washDetails,
        personalCommission,
        ...(globalScope
          ? {
              chargedPrice,
              commissions,
              totalCommission,
              netIncome: chargedPrice - totalCommission,
            }
          : {
              commissions: commissions.filter(
                (commission) => commission.user.id === user.id,
              ),
            }),
        photos: await Promise.all(
          photos.map(async (photo) => ({
            id: photo.id,
            width: photo.width,
            height: photo.height,
            url: await getR2ObjectUrl(photo.objectKey).catch(() => null),
          })),
        ),
      };
    }),
  );

  const income = Number(total._sum.chargedPrice ?? 0);
  const commissions = Number(commissionTotal._sum.amount ?? 0);
  const selectedCommission = Number(
    selectedCommissionTotal._sum.amount ?? 0,
  );
  return NextResponse.json({
    washes: serializedWashes,
    stats: globalScope
      ? {
          count: washes.length,
          income,
          commissions,
          selectedCommission,
          netIncome: income - commissions,
        }
      : {
          count: washes.length,
          selectedCommission,
        },
    range: {
      start: range.start,
      end: range.end,
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const parsed = createWashSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisa los datos del lavado." }, { status: 400 });
  }

  let creatorId = user.id;
  if (user.role === "ADMINISTRATIVE") {
    if (!parsed.data.createdById) {
      return NextResponse.json(
        { error: "Selecciona a nombre de quién se registra." },
        { status: 400 },
      );
    }

    const creator = await prisma.user.findFirst({
      where: {
        id: parsed.data.createdById,
        active: true,
        role: { in: ["ADMIN", "EMPLOYEE"] },
      },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "El responsable seleccionado no está disponible." },
        { status: 400 },
      );
    }

    creatorId = creator.id;
  } else if (parsed.data.createdById && parsed.data.createdById !== user.id) {
    return NextResponse.json(
      { error: "No puedes registrar lavados a nombre de otro usuario." },
      { status: 403 },
    );
  }

  const [vehicleType, servicePackage] = await Promise.all([
    prisma.vehicleType.findFirst({
      where: { id: parsed.data.vehicleTypeId, active: true },
    }),
    prisma.servicePackage.findFirst({
      where: { id: parsed.data.packageId, active: true },
    }),
  ]);

  if (!vehicleType || !servicePackage) {
    return NextResponse.json({ error: "El vehículo o paquete ya no está disponible." }, { status: 400 });
  }

  const needsCustomPrice =
    vehicleType.requiresCustom || servicePackage.requiresCustomPrice;
  let chargedPrice: number;

  if (needsCustomPrice) {
    if (!parsed.data.customPrice) {
      return NextResponse.json({ error: "Captura el precio acordado." }, { status: 400 });
    }
    chargedPrice = parsed.data.customPrice;
  } else {
    const configuredPrice = await prisma.servicePrice.findUnique({
      where: {
        vehicleTypeId_packageId: {
          vehicleTypeId: vehicleType.id,
          packageId: servicePackage.id,
        },
      },
    });
    if (!configuredPrice) {
      return NextResponse.json({ error: "Este paquete no tiene un precio configurado." }, { status: 400 });
    }
    chargedPrice = Number(configuredPrice.amount);
  }

  if (
    servicePackage.requiresDescription &&
    !parsed.data.customServiceDescription?.trim()
  ) {
    return NextResponse.json({ error: "Describe el servicio especial." }, { status: 400 });
  }

  const validParticipants = await prisma.user.findMany({
    where: {
      id: { in: [...new Set(parsed.data.participantIds)] },
      active: true,
      role: { in: ["ADMIN", "EMPLOYEE"] },
    },
    select: { id: true },
  });

  const workerIds = [
    creatorId,
    ...validParticipants
      .filter((participant) => participant.id !== creatorId)
      .map((participant) => participant.id),
  ];
  const ruleScopeKeys = [
    `package:${servicePackage.id}:vehicle:${vehicleType.id}`,
    `package:${servicePackage.id}`,
    `category:${servicePackage.category}`,
  ];
  const commissionRules = await prisma.commissionRule.findMany({
    where: {
      userId: { in: workerIds },
      scopeKey: { in: ruleScopeKeys },
    },
  });
  const rulesByUser = new Map<
    number,
    Map<string, (typeof commissionRules)[number]>
  >();
  for (const rule of commissionRules) {
    const userRules = rulesByUser.get(rule.userId) ?? new Map();
    userRules.set(rule.scopeKey, rule);
    rulesByUser.set(rule.userId, userRules);
  }
  const commissions = workerIds.map((userId) => {
    const userRules = rulesByUser.get(userId);
    const rule = ruleScopeKeys
      .map((scopeKey) => userRules?.get(scopeKey))
      .find(Boolean);
    const type = rule?.type ?? "PERCENTAGE";
    const value = Number(rule?.value ?? 0);
    const amount =
      type === "PERCENTAGE"
        ? Math.round(chargedPrice * value) / 100
        : value;

    return { userId, type, value, amount };
  });

  const wash = await prisma.wash.create({
    data: {
      plate: parsed.data.plate || null,
      notes: parsed.data.notes || null,
      customServiceDescription: parsed.data.customServiceDescription || null,
      chargedPrice,
      createdById: creatorId,
      vehicleTypeId: vehicleType.id,
      packageId: servicePackage.id,
      participants: {
        create: validParticipants
          .filter((participant) => participant.id !== creatorId)
          .map((participant) => ({ userId: participant.id })),
      },
      commissions: {
        create: commissions,
      },
    },
  });

  return NextResponse.json(
    { id: wash.id, chargedPrice: Number(wash.chargedPrice) },
    { status: 201 },
  );
}
