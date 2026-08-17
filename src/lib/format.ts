export function formatMoney(value: number | string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatPaymentType(value: "CASH" | "CARD" | "TRANSFER") {
  const labels = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
  } satisfies Record<"CASH" | "CARD" | "TRANSFER", string>;

  return labels[value];
}

export function localDayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
