import type { RecurringCadence } from "@/lib/finance/types";

const FAR_FUTURE = "9999-12-31";

function clampDay(year: number, monthIndex: number, day: number) {
  const maxDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(day, maxDays);
}

export function todayIso() {
  return new Date().toISOString().split("T")[0];
}

export function todayLocalIso(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toIsoDate(date: Date) {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid time value");
  }

  return date.toISOString().split("T")[0];
}

export function parseIsoDate(value: string) {
  const normalized = value.trim().slice(0, 10);
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function monthStartIso(value = new Date()) {
  return toIsoDate(new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)));
}

export function monthEndIso(value = new Date()) {
  return toIsoDate(new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)));
}

export function addCadence(dateIso: string, cadence: RecurringCadence) {
  if (cadence === "one-time") {
    return FAR_FUTURE;
  }

  const date = parseIsoDate(dateIso);
  const originalDay = date.getUTCDate();

  switch (cadence) {
    case "daily":
      date.setUTCDate(date.getUTCDate() + 1);
      return toIsoDate(date);
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7);
      return toIsoDate(date);
    case "bi-weekly": {
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const maxCurrentMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

      if (originalDay <= 15) {
        date.setUTCDate(Math.min(originalDay + 15, maxCurrentMonth));
      } else {
        const baseDay = originalDay === maxCurrentMonth ? 15 : originalDay - 15;
        date.setUTCMonth(date.getUTCMonth() + 1);
        const nextYear = date.getUTCFullYear();
        const nextMonth = date.getUTCMonth();
        date.setUTCDate(clampDay(nextYear, nextMonth, baseDay));
      }
      return toIsoDate(date);
    }
    case "monthly": {
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      date.setUTCFullYear(year, month, 1);
      date.setUTCDate(clampDay(date.getUTCFullYear(), date.getUTCMonth(), originalDay));
      return toIsoDate(date);
    }
    case "yearly": {
      const year = date.getUTCFullYear() + 1;
      const month = date.getUTCMonth();
      date.setUTCFullYear(year, month, 1);
      date.setUTCDate(clampDay(date.getUTCFullYear(), date.getUTCMonth(), originalDay));
      return toIsoDate(date);
    }
    default:
      return FAR_FUTURE;
  }
}

export function inferScheduledStatus(dateIso: string) {
  return dateIso > todayIso() ? "scheduled" : "pending";
}

export function buildAnchorDate(dayOfMonth: number, reference = todayIso()) {
  const base = parseIsoDate(reference);
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const clampedDay = clampDay(year, month, Math.max(1, Math.min(31, dayOfMonth)));
  const candidate = toIsoDate(new Date(Date.UTC(year, month, clampedDay)));
  return candidate >= todayIso()
    ? candidate
    : toIsoDate(new Date(Date.UTC(year, month + 1, clampDay(year, month + 1, clampedDay))));
}
