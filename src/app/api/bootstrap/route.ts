import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { localDayRange } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const { start, end } = localDayRange();
  const visibility = { createdById: user.id };

  const [vehicleTypes, packages, prices, users, todayCount, todayIncome] =
    await Promise.all([
      prisma.vehicleType.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.servicePackage.findMany({
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.servicePrice.findMany(),
      prisma.user.findMany({
        where: { active: true },
        select: { id: true, name: true, email: true, role: true, active: true },
        orderBy: { name: "asc" },
      }),
      prisma.wash.count({
        where: { ...visibility, createdAt: { gte: start, lt: end } },
      }),
      prisma.wash.aggregate({
        _sum: { chargedPrice: true },
        where: { ...visibility, createdAt: { gte: start, lt: end } },
      }),
    ]);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
    },
    users,
    vehicleTypes,
    packages,
    prices: prices.map((price) => ({ ...price, amount: Number(price.amount) })),
    today: {
      count: todayCount,
      income: Number(todayIncome._sum.chargedPrice ?? 0),
    },
  });
}
