export type AppUser = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  active: boolean;
  mustChangePassword?: boolean;
};

export type VehicleTypeOption = {
  id: number;
  name: string;
  slug: string;
  requiresCustom: boolean;
  active: boolean;
  sortOrder: number;
};

export type ServicePackageOption = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: "NORMAL" | "INTERIOR" | "SPECIAL";
  requiresCustomPrice: boolean;
  requiresDescription: boolean;
  active: boolean;
  sortOrder: number;
};

export type ServicePriceOption = {
  id: number;
  amount: number;
  vehicleTypeId: number;
  packageId: number;
};

export type BootstrapData = {
  user: AppUser;
  users: AppUser[];
  vehicleTypes: VehicleTypeOption[];
  packages: ServicePackageOption[];
  prices: ServicePriceOption[];
  today: {
    count: number;
    income: number;
  };
};

export type WashRecord = {
  id: number;
  plate: string | null;
  chargedPrice: number;
  notes: string | null;
  customServiceDescription: string | null;
  createdAt: string;
  vehicleType: { name: string };
  package: { name: string; category: "NORMAL" | "INTERIOR" | "SPECIAL" };
  createdBy: { id: number; name: string };
  participants: { user: { id: number; name: string } }[];
  photos: {
    id: number;
    url: string | null;
    width: number;
    height: number;
  }[];
};
