import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  vehicleTypeId: z.number().int().positive(),
  packageId: z.number().int().positive(),
  amount: z.number().min(0).max(999999),
});

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Precio inválido." }, { status: 400 });
  }

  const price = await prisma.servicePrice.upsert({
    where: {
      vehicleTypeId_packageId: {
        vehicleTypeId: parsed.data.vehicleTypeId,
        packageId: parsed.data.packageId,
      },
    },
    update: { amount: parsed.data.amount },
    create: parsed.data,
  });

  return NextResponse.json({ ...price, amount: Number(price.amount) });
}
