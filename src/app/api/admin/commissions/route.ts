import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canAccessAdministration,
  getCurrentUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const targetSchema = z
  .object({
    userId: z.number().int().positive(),
    scope: z.enum(["CATEGORY", "PACKAGE", "VEHICLE_PACKAGE"]),
    category: z.enum(["NORMAL", "INTERIOR", "SPECIAL"]).optional(),
    packageId: z.number().int().positive().optional(),
    vehicleTypeId: z.number().int().positive().optional(),
  })
  .superRefine((data, context) => {
    if (data.scope === "CATEGORY" && !data.category) {
      context.addIssue({
        code: "custom",
        path: ["category"],
        message: "Selecciona una categoría.",
      });
    }
    if (data.scope !== "CATEGORY" && !data.packageId) {
      context.addIssue({
        code: "custom",
        path: ["packageId"],
        message: "Selecciona un servicio.",
      });
    }
    if (data.scope === "VEHICLE_PACKAGE" && !data.vehicleTypeId) {
      context.addIssue({
        code: "custom",
        path: ["vehicleTypeId"],
        message: "Selecciona un vehículo.",
      });
    }
  });

const commissionSchema = targetSchema.and(
  z
    .object({
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
    }),
);

type RuleTarget = z.infer<typeof targetSchema>;

function getTarget(data: RuleTarget) {
  if (data.scope === "CATEGORY") {
    return {
      scopeKey: `category:${data.category}`,
      category: data.category!,
      packageId: null,
      vehicleTypeId: null,
    };
  }
  if (data.scope === "VEHICLE_PACKAGE") {
    return {
      scopeKey: `package:${data.packageId}:vehicle:${data.vehicleTypeId}`,
      category: null,
      packageId: data.packageId!,
      vehicleTypeId: data.vehicleTypeId!,
    };
  }
  return {
    scopeKey: `package:${data.packageId}`,
    category: null,
    packageId: data.packageId!,
    vehicleTypeId: null,
  };
}

async function currentAdmin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? user : null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdministration(user.role)) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const rules = await prisma.commissionRule.findMany({
    orderBy: [{ userId: "asc" }, { scopeKey: "asc" }],
  });

  return NextResponse.json(
    rules.map((rule) => ({ ...rule, value: Number(rule.value) })),
  );
}

export async function PUT(request: Request) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const parsed = commissionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Comisión inválida." },
      { status: 400 },
    );
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      id: parsed.data.userId,
      active: true,
      role: { in: ["ADMIN", "EMPLOYEE"] },
    },
    select: { id: true },
  });
  if (!targetUser) {
    return NextResponse.json(
      { error: "Selecciona un trabajador activo." },
      { status: 400 },
    );
  }

  if (parsed.data.packageId) {
    const servicePackage = await prisma.servicePackage.findUnique({
      where: { id: parsed.data.packageId },
      select: { id: true },
    });
    if (!servicePackage) {
      return NextResponse.json(
        { error: "El servicio seleccionado no existe." },
        { status: 400 },
      );
    }
  }
  if (parsed.data.vehicleTypeId) {
    const vehicle = await prisma.vehicleType.findUnique({
      where: { id: parsed.data.vehicleTypeId },
      select: { id: true },
    });
    if (!vehicle) {
      return NextResponse.json(
        { error: "El vehículo seleccionado no existe." },
        { status: 400 },
      );
    }
  }

  const target = getTarget(parsed.data);
  const rule = await prisma.commissionRule.upsert({
    where: {
      userId_scopeKey: {
        userId: parsed.data.userId,
        scopeKey: target.scopeKey,
      },
    },
    update: {
      type: parsed.data.type,
      value: parsed.data.value,
      ...target,
    },
    create: {
      userId: parsed.data.userId,
      type: parsed.data.type,
      value: parsed.data.value,
      ...target,
    },
  });

  return NextResponse.json({ ...rule, value: Number(rule.value) });
}

export async function DELETE(request: Request) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  }

  const parsed = targetSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Regla de comisión inválida." },
      { status: 400 },
    );
  }

  const target = getTarget(parsed.data);
  await prisma.commissionRule.deleteMany({
    where: {
      userId: parsed.data.userId,
      scopeKey: target.scopeKey,
    },
  });

  return new NextResponse(null, { status: 204 });
}
