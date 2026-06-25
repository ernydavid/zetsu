import * as React from "react";

interface FrequencySelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function IncomeFrequencySelect({ className, ...props }: FrequencySelectProps) {
  return (
    <div className="relative">
      <select
        className="flex h-10 w-full bg-background px-3 py-2 text-sm rounded-xl border border-premium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground font-mono transition-colors appearance-none cursor-pointer"
        {...props}
      >
        <option value="weekly">Semanal</option>
        <option value="bi-weekly">Quincenal</option>
        <option value="monthly">Mensual</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground font-mono text-xs border-l border-border">
        ▼
      </div>
    </div>
  );
}

export function SubscriptionFrequencySelect({ className, ...props }: FrequencySelectProps) {
  return (
    <div className="relative">
      <select
        className="flex h-10 w-full bg-background px-3 py-2 text-sm rounded-xl border border-premium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground font-mono transition-colors appearance-none cursor-pointer"
        {...props}
      >
        <option value="daily">Diario</option>
        <option value="weekly">Semanal</option>
        <option value="bi-weekly">Quincenal</option>
        <option value="monthly">Mensual</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground font-mono text-xs border-l border-border">
        ▼
      </div>
    </div>
  );
}
