export type AppUser = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "ADMINISTRATIVE" | "EMPLOYEE";
  isPartner?: boolean;
  partnerSharePercentage?: number | null;
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

export type CommissionRuleOption = {
  id: number;
  scopeKey: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  category: "NORMAL" | "INTERIOR" | "SPECIAL" | null;
  userId: number;
  vehicleTypeId: number | null;
  packageId: number | null;
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

export type ExpenseRecord = {
  id: number;
  expenseDate: string;
  concept: string;
  amount: number;
  notes: string | null;
  takenFromCash: boolean;
  reimbursable: boolean;
  partner: { id: number; name: string } | null;
  createdBy: { id: number; name: string };
  createdAt: string;
};

export type ProfitDetail = {
  income: number;
  commissions: number;
  expenses: number;
  cashExpenses: number;
  externalExpenses: number;
  reimbursableExpenses: number;
  netIncome: number;
  cashBeforePartnerPayout: number;
  totalPartnerPayout: number;
  externalNonReimbursableExpenses: number;
  partnerShareTotal: number;
  hasValidPartnerShares: boolean;
  partners: {
    id: number;
    name: string;
    sharePercentage: number;
    profitShare: number;
    reimbursement: number;
    totalPayout: number;
  }[];
};

export type PaymentType = "CASH" | "CARD" | "TRANSFER";

export type WashRecord = {
  id: number;
  plate: string | null;
  chargedPrice?: number;
  paymentType: PaymentType;
  totalCommission?: number;
  netIncome?: number;
  personalCommission: number;
  notes: string | null;
  customServiceDescription: string | null;
  deletedAt?: string | null;
  deletedBy?: { id: number; name: string } | null;
  createdAt: string;
  vehicleType: { name: string };
  package: { name: string; category: "NORMAL" | "INTERIOR" | "SPECIAL" };
  createdBy: { id: number; name: string };
  participants: { user: { id: number; name: string } }[];
  commissions: {
    type: "PERCENTAGE" | "FIXED";
    value: number;
    amount: number;
    user: { id: number; name: string };
  }[];
  photos: {
    id: number;
    url: string | null;
    width: number;
    height: number;
  }[];
};
