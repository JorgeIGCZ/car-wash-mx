import { prisma } from "@/lib/prisma";

export const WEEK_DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export async function getWorkWeekSettings() {
  const settings = await prisma.appSetting.findMany({
    where: {
      key: { in: ["work_week_start", "work_week_end"] },
    },
  });
  const values = Object.fromEntries(
    settings.map((setting) => [setting.key, Number(setting.value)]),
  );

  return {
    startDay: isValidDay(values.work_week_start) ? values.work_week_start : 1,
    endDay: isValidDay(values.work_week_end) ? values.work_week_end : 6,
  };
}

export function getWorkWeekRange(
  now: Date,
  startDay: number,
  endDay: number,
) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const daysSinceStart = (start.getDay() - startDay + 7) % 7;
  start.setDate(start.getDate() - daysSinceStart);

  const end = new Date(start);
  const daysThroughEnd = (endDay - startDay + 7) % 7;
  end.setDate(end.getDate() + daysThroughEnd + 1);

  return { start, end };
}

function isValidDay(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}
