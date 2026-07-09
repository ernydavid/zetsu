"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IncomeFrequencySelect } from "@/components/common/frequency-select";

interface IncomeRecurringFieldsProps {
  frequency: "weekly" | "bi-weekly" | "monthly";
  onFrequencyChange: (value: "weekly" | "bi-weekly" | "monthly") => void;
  primaryDay: string;
  onPrimaryDayChange: (value: string) => void;
  secondaryDay: string;
  onSecondaryDayChange: (value: string) => void;
  frequencyId: string;
  primaryDayId: string;
  secondaryDayId: string;
  namePrefix?: string;
}

function normalizeDayValue(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return String(Math.max(1, Math.min(31, parsed)));
}

function computeBiWeeklyPair(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return { primary: "", secondary: "" };
  }

  const primary = Math.max(1, Math.min(15, parsed));
  return {
    primary: String(primary),
    secondary: String(primary + 15),
  };
}

export function IncomeRecurringFields({
  frequency,
  onFrequencyChange,
  primaryDay,
  onPrimaryDayChange,
  secondaryDay,
  onSecondaryDayChange,
  frequencyId,
  primaryDayId,
  secondaryDayId,
}: IncomeRecurringFieldsProps) {
  React.useEffect(() => {
    if (frequency !== "bi-weekly") {
      return;
    }

    const nextPair = computeBiWeeklyPair(primaryDay || "1");
    if (nextPair.primary && nextPair.primary !== primaryDay) {
      onPrimaryDayChange(nextPair.primary);
      return;
    }
    if (nextPair.secondary !== secondaryDay) {
      onSecondaryDayChange(nextPair.secondary);
    }
  }, [frequency, onPrimaryDayChange, onSecondaryDayChange, primaryDay, secondaryDay]);

  const helperDays = computeBiWeeklyPair(primaryDay || "1");

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label htmlFor={frequencyId} className="text-[10px] font-bold uppercase">Frecuencia</Label>
        <IncomeFrequencySelect
          id={frequencyId}
          name="frequency"
          value={frequency}
          onChange={(event) => onFrequencyChange(event.target.value as "weekly" | "bi-weekly" | "monthly")}
        />
      </div>

      {frequency === "bi-weekly" ? (
        <div className="col-span-2 space-y-3">
          <div className="space-y-1">
            <Label htmlFor={primaryDayId} className="text-[10px] font-bold uppercase">Día base de la quincena</Label>
            <Input
              id={primaryDayId}
              name="schedule_days"
              type="number"
              min="1"
              max="15"
              placeholder="10"
              value={helperDays.primary || primaryDay}
              onChange={(event) => {
                const nextPair = computeBiWeeklyPair(normalizeDayValue(event.target.value));
                onPrimaryDayChange(nextPair.primary);
                onSecondaryDayChange(nextPair.secondary);
              }}
              required
            />
          </div>
          <input type="hidden" name="schedule_days" value={helperDays.secondary || secondaryDay || "16"} />
          <input type="hidden" name="day_of_month" value={helperDays.primary || primaryDay || "1"} />
          <p className="text-[10px] text-accent-soft-fg font-mono leading-relaxed">
            {helperDays.primary && helperDays.secondary
              ? `Los ingresos se crearán los días ${helperDays.primary} y ${helperDays.secondary} de cada mes.`
              : "El segundo día de la quincena se calcula automáticamente a partir del primero."}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <Label htmlFor={primaryDayId} className="text-[10px] font-bold uppercase">Día del Mes</Label>
          <Input
            id={primaryDayId}
            name="day_of_month"
            type="number"
            min="1"
            max="31"
            placeholder="15"
            value={primaryDay}
            onChange={(event) => onPrimaryDayChange(normalizeDayValue(event.target.value))}
            required
          />
        </div>
      )}
    </div>
  );
}
