import { PrismaClient, ServiceCategory, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const vehicleTypes = [
  { name: "Sedán", slug: "sedan", sortOrder: 1 },
  { name: "Pickup", slug: "pickup", sortOrder: 2 },
  { name: "SUV", slug: "suv", sortOrder: 3 },
  { name: "3 filas", slug: "tres-filas", sortOrder: 4 },
  { name: "Especial", slug: "especial", sortOrder: 5, requiresCustom: true },
];

const packages = [
  { name: "Completo", slug: "normal-completo", category: ServiceCategory.NORMAL, sortOrder: 1, description: "Lavado interior y exterior" },
  { name: "Solo exterior", slug: "normal-exterior", category: ServiceCategory.NORMAL, sortOrder: 2, description: "Lavado exterior" },
  { name: "Solo alfombra", slug: "interior-alfombra", category: ServiceCategory.INTERIOR, sortOrder: 1 },
  { name: "Solo asientos", slug: "interior-asientos", category: ServiceCategory.INTERIOR, sortOrder: 2 },
  { name: "Solo cielo", slug: "interior-cielo", category: ServiceCategory.INTERIOR, sortOrder: 3 },
  { name: "Asientos + cielo", slug: "interior-asientos-cielo", category: ServiceCategory.INTERIOR, sortOrder: 4 },
  { name: "Asientos + alfombra", slug: "interior-asientos-alfombra", category: ServiceCategory.INTERIOR, sortOrder: 5 },
  { name: "Interior completo", slug: "interior-completo", category: ServiceCategory.INTERIOR, sortOrder: 6, description: "Cielo, alfombras y asientos" },
  {
    name: "Servicio especial",
    slug: "servicio-especial",
    category: ServiceCategory.SPECIAL,
    sortOrder: 1,
    requiresCustomPrice: true,
    requiresDescription: true,
    description: "Servicio y precio capturados libremente",
  },
];

const basePrices: Record<string, number[]> = {
  "normal-completo": [150, 180, 180, 220],
  "normal-exterior": [80, 100, 100, 120],
  "interior-alfombra": [550, 650, 650, 800],
  "interior-asientos": [650, 750, 750, 900],
  "interior-cielo": [450, 550, 550, 650],
  "interior-asientos-cielo": [950, 1100, 1100, 1300],
  "interior-asientos-alfombra": [1050, 1200, 1200, 1450],
  "interior-completo": [1350, 1550, 1550, 1850],
};

async function main() {
  await prisma.appSetting.upsert({
    where: { key: "work_week_start" },
    update: {},
    create: { key: "work_week_start", value: "1" },
  });

  await prisma.appSetting.upsert({
    where: { key: "work_week_end" },
    update: {},
    create: { key: "work_week_end", value: "6" },
  });

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
  });

  if (!existingAdmin) {
    if (!adminEmail || !adminPassword || adminPassword.length < 10) {
      throw new Error(
        "Define INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD (mínimo 10 caracteres) para crear el primer administrador.",
      );
    }
    await prisma.user.create({
      data: {
        name: process.env.INITIAL_ADMIN_NAME || "Administrador",
        email: adminEmail,
        passwordHash: await hash(adminPassword, 12),
        mustChangePassword: true,
        role: UserRole.ADMIN,
      },
    });
  }

  const employeeEmail = process.env.INITIAL_EMPLOYEE_EMAIL?.toLowerCase();
  const employeePassword = process.env.INITIAL_EMPLOYEE_PASSWORD;
  if (employeeEmail && employeePassword) {
    const existingEmployee = await prisma.user.findUnique({
      where: { email: employeeEmail },
    });
    if (!existingEmployee) {
      if (employeePassword.length < 10) {
        throw new Error("INITIAL_EMPLOYEE_PASSWORD debe tener al menos 10 caracteres.");
      }
      await prisma.user.create({
        data: {
          name: process.env.INITIAL_EMPLOYEE_NAME || "Encargado",
          email: employeeEmail,
          passwordHash: await hash(employeePassword, 12),
          mustChangePassword: true,
          role: UserRole.EMPLOYEE,
        },
      });
    }
  }

  for (const item of vehicleTypes) {
    await prisma.vehicleType.upsert({
      where: { slug: item.slug },
      update: item,
      create: item,
    });
  }

  for (const item of packages) {
    await prisma.servicePackage.upsert({
      where: { slug: item.slug },
      update: item,
      create: item,
    });
  }

  const standardVehicles = await prisma.vehicleType.findMany({
    where: { requiresCustom: false },
    orderBy: { sortOrder: "asc" },
  });
  const storedPackages = await prisma.servicePackage.findMany({
    where: { slug: { in: Object.keys(basePrices) } },
  });

  for (const servicePackage of storedPackages) {
    const prices = basePrices[servicePackage.slug];
    for (const [index, vehicle] of standardVehicles.entries()) {
      await prisma.servicePrice.upsert({
        where: {
          vehicleTypeId_packageId: {
            vehicleTypeId: vehicle.id,
            packageId: servicePackage.id,
          },
        },
        update: { amount: prices[index] },
        create: {
          vehicleTypeId: vehicle.id,
          packageId: servicePackage.id,
          amount: prices[index],
        },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
