import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { localDayRange } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getR2ObjectUrl } from "@/lib/r2";
import { getWorkWeekRange, getWorkWeekSettings } from "@/lib/work-week";

const createWashSchema = z.object({
  vehicleTypeId: z.number().int().positive(),
  packageId: z.number().int().positive(),
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
  const visibility = user.role === "ADMIN" ? {} : { createdById: user.id };
  const where = {
    ...visibility,
    createdAt: { gte: range.start, lt: range.end },
  };

  const [washes, total] = await Promise.all([
    prisma.wash.findMany({
      where,
      include: {
        vehicleType: { select: { name: true } },
        package: { select: { name: true, category: true } },
        createdBy: { select: { id: true, name: true } },
        participants: {
          include: { user: { select: { id: true, name: true } } },
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
  ]);

  const serializedWashes = await Promise.all(
    washes.map(async (wash) => ({
      ...wash,
      chargedPrice: Number(wash.chargedPrice),
      photos: await Promise.all(
        wash.photos.map(async (photo) => ({
          id: photo.id,
          width: photo.width,
          height: photo.height,
          url: await getR2ObjectUrl(photo.objectKey).catch(() => null),
        })),
      ),
    })),
  );

  return NextResponse.json({
    washes: serializedWashes,
    stats: {
      count: washes.length,
      income: Number(total._sum.chargedPrice ?? 0),
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
    },
    select: { id: true },
  });

  const wash = await prisma.wash.create({
    data: {
      plate: parsed.data.plate || null,
      notes: parsed.data.notes || null,
      customServiceDescription: parsed.data.customServiceDescription || null,
      chargedPrice,
      createdById: user.id,
      vehicleTypeId: vehicleType.id,
      packageId: servicePackage.id,
      participants: {
        create: validParticipants
          .filter((participant) => participant.id !== user.id)
          .map((participant) => ({ userId: participant.id })),
      },
    },
  });

  return NextResponse.json(
    { id: wash.id, chargedPrice: Number(wash.chargedPrice) },
    { status: 201 },
  );
}
