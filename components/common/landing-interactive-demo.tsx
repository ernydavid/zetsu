"use client";

import * as React from "react";
import { IconBolt, IconCreditCard, IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Scenario = "stable" | "tight" | "growth";

type DemoState = {
  salary: number;
  freelance: number;
  rent: number;
  netflix: boolean;
  gym: boolean;
};

const scenarios: Record<Scenario, DemoState> = {
  stable: {
    salary: 4000,
    freelance: 1200,
    rent: 950,
    netflix: true,
    gym: false,
  },
  tight: {
    salary: 3200,
    freelance: 250,
    rent: 1100,
    netflix: true,
    gym: true,
  },
  growth: {
    salary: 4600,
    freelance: 1800,
    rent: 950,
    netflix: true,
    gym: true,
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMetricCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

function sanitizeNumber(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export function LandingInteractiveDemo() {
  const [state, setState] = React.useState<DemoState>(scenarios.stable);

  const subscriptions = [
    { id: "netflix", label: "netflix_premium", amount: 16, enabled: state.netflix },
    { id: "gym", label: "gym_membership", amount: 42, enabled: state.gym },
  ] as const;

  const activeSubscriptions = subscriptions.filter((item) => item.enabled);
  const subscriptionTotal = activeSubscriptions.reduce((sum, item) => sum + item.amount, 0);
  const incomeTotal = state.salary + state.freelance;
  const expensesTotal = state.rent + subscriptionTotal;
  const netBalance = incomeTotal - expensesTotal;

  const applyScenario = (scenario: Scenario) => {
    setState(scenarios[scenario]);
  };

  const updateField = (field: keyof Pick<DemoState, "salary" | "freelance" | "rent">, value: string) => {
    setState((current) => ({
      ...current,
      [field]: sanitizeNumber(value),
    }));
  };

  const updateSubscription = (field: "netflix" | "gym", checked: boolean) => {
    setState((current) => ({
      ...current,
      [field]: checked,
    }));
  };

  return (
    <Card className="flex h-auto w-full max-w-[640px] flex-col bg-background p-0! shadow-premium-lg md:h-[min(730px,calc(100vh-8.5rem))] md:max-h-[730px]">
      <div className="border-b border-premium p-3 flex items-center justify-between bg-muted/20 font-mono text-[9px] md:text-[10px]">
        <div className="flex space-x-2">
          <div className="size-2.5 border border-foreground bg-foreground"></div>
          <div className="size-2.5 border border-foreground"></div>
          <div className="size-2.5 border border-foreground bg-muted"></div>
        </div>
        <span>zetsu_live_demo.exe</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3.5 md:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] md:text-[10px] uppercase font-mono text-muted-foreground tracking-[0.2em]">
              demo interactiva
            </p>
            <h3 className="font-heading-style text-base md:text-lg font-black lowercase leading-tight">
              mueve números y mira el saldo en tiempo real
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="xs" variant="outline" onClick={() => applyScenario("stable")}>
              mes estable
            </Button>
            <Button size="xs" variant="outline" onClick={() => applyScenario("tight")}>
              mes ajustado
            </Button>
            <Button size="xs" variant="outline" onClick={() => applyScenario("growth")}>
              mes fuerte
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 min-[430px]:grid-cols-3">
            <div className="rounded-2xl border border-premium bg-muted/10 p-3 min-w-0">
              <p className="text-[9px] md:text-[10px] uppercase font-mono text-muted-foreground font-bold tracking-wider">
                ingresos
              </p>
              <p className="mt-1.5 text-sm md:text-[15px] xl:text-base font-mono font-bold tracking-tight whitespace-nowrap leading-none">
                {formatMetricCurrency(incomeTotal)}
              </p>
            </div>
            <div className="rounded-2xl border border-premium bg-muted/10 p-3 min-w-0">
              <p className="text-[9px] md:text-[10px] uppercase font-mono text-muted-foreground font-bold tracking-wider">
                gastos
              </p>
              <p className="mt-1.5 text-sm md:text-[15px] xl:text-base font-mono font-bold tracking-tight whitespace-nowrap leading-none">
                {formatMetricCurrency(expensesTotal)}
              </p>
            </div>
            <div className="rounded-2xl border border-premium bg-muted/10 p-3 min-w-0">
              <p className="text-[9px] md:text-[10px] uppercase font-mono text-muted-foreground font-bold tracking-wider">
                saldo neto
              </p>
              <p
                className={
                  "mt-1.5 text-sm md:text-[15px] xl:text-base font-mono font-bold tracking-tight whitespace-nowrap leading-none " +
                  (netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")
                }
              >
                {formatMetricCurrency(netBalance)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.92fr]">
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="demo-salary">salario base</Label>
                  <Input
                    id="demo-salary"
                    type="number"
                    min="0"
                    step="50"
                    value={state.salary}
                    onChange={(event) => updateField("salary", event.target.value)}
                    className="h-8 text-[11px]"
                  />
                </div>
                <div>
                  <Label htmlFor="demo-freelance">freelance</Label>
                  <Input
                    id="demo-freelance"
                    type="number"
                    min="0"
                    step="50"
                    value={state.freelance}
                    onChange={(event) => updateField("freelance", event.target.value)}
                    className="h-8 text-[11px]"
                  />
                </div>
                <div>
                  <Label htmlFor="demo-rent">arriendo</Label>
                  <Input
                    id="demo-rent"
                    type="number"
                    min="0"
                    step="50"
                    value={state.rent}
                    onChange={(event) => updateField("rent", event.target.value)}
                    className="h-8 text-[11px]"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-border p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] md:text-[10px] uppercase font-mono text-muted-foreground tracking-wider">
                      suscripciones activas
                    </p>
                    <p className="font-mono text-[11px] md:text-xs">{activeSubscriptions.length} encendidas</p>
                  </div>
                  <span className="rounded-full border border-premium px-2 py-1 text-[9px] md:text-[10px] font-mono">
                    {formatCurrency(subscriptionTotal)}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-premium p-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] md:text-xs font-bold break-all">netflix_premium</p>
                      <p className="text-[9px] md:text-[10px] font-mono text-muted-foreground">streaming mensual</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] md:text-xs">-$16</span>
                      <Switch checked={state.netflix} onCheckedChange={(checked) => updateSubscription("netflix", checked)} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-premium p-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] md:text-xs font-bold break-all">gym_membership</p>
                      <p className="text-[9px] md:text-[10px] font-mono text-muted-foreground">salud y rutina</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] md:text-xs">-$42</span>
                      <Switch checked={state.gym} onCheckedChange={(checked) => updateSubscription("gym", checked)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-premium p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-heading-style font-black text-sm md:text-base lowercase">/movimientos simulados</h4>
                  <span className="text-[9px] md:text-[10px] font-mono text-muted-foreground">[live]</span>
                </div>

                <div className="space-y-2 font-mono text-[11px] md:text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-premium bg-muted/10 p-3">
                    <span className="flex min-w-0 items-center gap-2 break-all">
                      <IconTrendingUp className="size-3.5 text-emerald-500" />
                      nomina_principal
                    </span>
                    <span className="shrink-0">+{formatCurrency(state.salary)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-premium bg-muted/10 p-3">
                    <span className="flex min-w-0 items-center gap-2 break-all">
                      <IconBolt className="size-3.5 text-emerald-500" />
                      trabajo_freelance
                    </span>
                    <span className="shrink-0">+{formatCurrency(state.freelance)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-premium bg-muted/10 p-3">
                    <span className="flex min-w-0 items-center gap-2 break-all">
                      <IconCreditCard className="size-3.5 text-destructive" />
                      arriendo
                    </span>
                    <span className="shrink-0">-{formatCurrency(state.rent)}</span>
                  </div>
                  {activeSubscriptions.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-destructive"
                    >
                      <span className="flex min-w-0 items-center gap-2 font-bold break-all">
                        <IconTrendingDown className="size-3.5" />
                        {item.label}
                      </span>
                      <span className="shrink-0 font-bold">-{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
