import { addCadence } from "@/lib/finance/dates";
import type { FinanceRecurringRule, RecurringCadence } from "@/lib/finance/types";

const DEFAULT_DAY = 1;

function clampDay(year: number, monthIndex: number, day: number) {
  const maxDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(Math.max(day, 1), maxDays);
}

function toIsoDate(date: Date) {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid time value");
  }

  return date.toISOString().split("T")[0];
}

function parseIsoDate(value: string) {
  const normalized = value.trim().slice(0, 10);
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

export const SUBSCRIPTION_CATEGORY_PRESETS = [
  "entretenimiento",
  "software",
  "servicios",
  "hogar",
  "salud",
  "educación",
  "membresías",
  "otros",
] as const;

export function buildCategoryLibrary(categories: string[] = []) {
  const merged = [...SUBSCRIPTION_CATEGORY_PRESETS, ...categories]
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(merged.map((value) => value.toLowerCase())));
}

export function normalizeScheduleDays(values: Array<string | number | null | undefined>) {
  const parsed = values
    .map((value) => Number.parseInt(String(value ?? ""), 10))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(1, Math.min(31, value)));

  return Array.from(new Set(parsed)).sort((a, b) => a - b);
}

export function buildRecurringScheduleConfig(
  cadence: RecurringCadence,
  scheduleDays: number[] = [],
) {
  if (cadence === "bi-weekly" && scheduleDays.length >= 2) {
    return {
      mode: "custom_days",
      days: scheduleDays.slice(0, 2),
    };
  }

  return {};
}

export function getRecurringRuleScheduleDays(
  rule: Pick<FinanceRecurringRule, "cadence" | "anchor_date" | "schedule_config">,
) {
  if (rule.cadence !== "bi-weekly") {
    return [];
  }

  const configured = rule.schedule_config?.days;
  if (Array.isArray(configured)) {
    const normalized = normalizeScheduleDays(configured as Array<string | number>);
    if (normalized.length >= 2) {
      return normalized.slice(0, 2);
    }
  }

  const anchorDate = parseIsoDate(rule.anchor_date);
  const baseDay = Math.max(DEFAULT_DAY, Math.min(31, anchorDate.getUTCDate()));
  return [baseDay, Math.min(baseDay + 15, 31)];
}

export function buildAnchorDateFromSchedule(
  cadence: RecurringCadence,
  dayOfMonth: number,
  scheduleDays: number[] = [],
  reference = todayIso(),
) {
  if (cadence === "bi-weekly" && scheduleDays.length >= 2) {
    const base = parseIsoDate(reference);
    const year = base.getUTCFullYear();
    const month = base.getUTCMonth();
    const today = todayIso();
    const candidates = scheduleDays
      .map((day) => toIsoDate(new Date(Date.UTC(year, month, clampDay(year, month, day)))))
      .filter((candidate) => candidate >= today)
      .sort();

    if (candidates.length > 0) {
      return candidates[0];
    }

    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const normalizedNextMonth = nextMonth > 11 ? 0 : nextMonth;
    return toIsoDate(
      new Date(
        Date.UTC(
          nextYear,
          normalizedNextMonth,
          clampDay(nextYear, normalizedNextMonth, scheduleDays[0] ?? DEFAULT_DAY),
        ),
      ),
    );
  }

  const base = parseIsoDate(reference);
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const clampedDay = clampDay(year, month, Math.max(1, Math.min(31, dayOfMonth)));
  const candidate = toIsoDate(new Date(Date.UTC(year, month, clampedDay)));

  if (cadence === "daily" || cadence === "weekly") {
    return todayIso();
  }

  if (candidate >= todayIso()) {
    return candidate;
  }

  const nextMonth = month + 1;
  const nextYear = nextMonth > 11 ? year + 1 : year;
  const normalizedNextMonth = nextMonth > 11 ? 0 : nextMonth;
  return toIsoDate(
    new Date(Date.UTC(nextYear, normalizedNextMonth, clampDay(nextYear, normalizedNextMonth, clampedDay))),
  );
}

export function buildCustomBiWeeklyOccurrences(params: {
  startDate: string;
  limitDate: string;
  scheduleDays: number[];
}) {
  const start = parseIsoDate(params.startDate);
  const limit = parseIsoDate(params.limitDate);
  const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const occurrences: string[] = [];

  while (current <= limit) {
    const year = current.getUTCFullYear();
    const month = current.getUTCMonth();

    for (const day of params.scheduleDays) {
      const candidate = toIsoDate(new Date(Date.UTC(year, month, clampDay(year, month, day))));
      if (candidate >= params.startDate && candidate <= params.limitDate) {
        occurrences.push(candidate);
      }
    }

    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return Array.from(new Set(occurrences)).sort();
}

export function collectRecurringOccurrencesInRange(
  rule: Pick<FinanceRecurringRule, "cadence" | "anchor_date" | "next_occurrence" | "schedule_config">,
  rangeStart: string,
  rangeEnd: string,
) {
  if (rangeEnd < rangeStart) {
    return [];
  }

  const alignedStart = rule.next_occurrence || rule.anchor_date;

  if (rule.cadence === "bi-weekly" && getRecurringRuleScheduleDays(rule).length >= 2) {
    return buildCustomBiWeeklyOccurrences({
      startDate: alignedStart > rangeStart ? alignedStart : rangeStart,
      limitDate: rangeEnd,
      scheduleDays: getRecurringRuleScheduleDays(rule),
    });
  }

  const occurrences: string[] = [];
  let occurrence = alignedStart;

  while (occurrence < rangeStart) {
    const nextOccurrence = addCadence(occurrence, rule.cadence);
    if (nextOccurrence === occurrence) {
      break;
    }
    occurrence = nextOccurrence;
  }

  while (occurrence <= rangeEnd) {
    occurrences.push(occurrence);
    const nextOccurrence = addCadence(occurrence, rule.cadence);
    if (nextOccurrence === occurrence) {
      break;
    }
    occurrence = nextOccurrence;
  }

  return Array.from(new Set(occurrences)).sort();
}

export function getNextRecurringOccurrence(
  rule: Pick<FinanceRecurringRule, "cadence" | "anchor_date" | "next_occurrence" | "schedule_config">,
  reference = todayIso(),
) {
  const alignedStart = rule.next_occurrence || rule.anchor_date;

  if (rule.cadence === "bi-weekly" && getRecurringRuleScheduleDays(rule).length >= 2) {
    const referenceDate = parseIsoDate(reference);
    const limitDate = new Date(referenceDate);
    limitDate.setUTCDate(limitDate.getUTCDate() + 62);

    const [nextOccurrence] = buildCustomBiWeeklyOccurrences({
      startDate: alignedStart > reference ? alignedStart : reference,
      limitDate: toIsoDate(limitDate),
      scheduleDays: getRecurringRuleScheduleDays(rule),
    });

    return nextOccurrence ?? null;
  }

  let occurrence = alignedStart;

  while (occurrence < reference) {
    const nextOccurrence = addCadence(occurrence, rule.cadence);
    if (nextOccurrence === occurrence) {
      break;
    }
    occurrence = nextOccurrence;
  }

  return occurrence ?? null;
}
