import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkWeekSettings } from "@/lib/work-week";

const schema = z.object({
  startDay: z.number().int().min(0).max(6),
  endDay: z.number().int().min(0).max(6),
});

async function isAdmin() {
  return (await getCurrentUser())?.role === "ADMIN";
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  return NextResponse.json(await getWorkWeekSettings());
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Selecciona días válidos para la semana laboral." },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: "work_week_start" },
      update: { value: String(parsed.data.startDay) },
      create: { key: "work_week_start", value: String(parsed.data.startDay) },
    }),
    prisma.appSetting.upsert({
      where: { key: "work_week_end" },
      update: { value: String(parsed.data.endDay) },
      create: { key: "work_week_end", value: String(parsed.data.endDay) },
    }),
  ]);

  return NextResponse.json(parsed.data);
}
