"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sidebar } from "@/components/common/sidebar";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { setBudgetCategoryValue } from "@/app/dashboard/actions";
import type { FinanceProfile } from "@/lib/finance/types";
import {
  IconArrowLeft,
  IconArrowRight,
  IconPigMoney,
  IconTargetArrow,
  IconWallet,
  IconX,
} from "@tabler/icons-react";

const ONBOARDING_STORAGE_KEY = "zetsu-budget-onboarding-seen-v1";

interface BudgetRow {
  category: {
    id: string;
    name: string;
    group_name: string;
  };
  assigned: number;
  target: number;
  activity: number;
  available: number;
  rolloverEnabled: boolean;
}

interface BudgetClientProps {
  profile: FinanceProfile;
  budgetMonth: {
    id: string;
    month: string;
  };
  budgetRows: BudgetRow[];
  availableToBudget: number;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

const onboardingSteps = [
  {
    id: "available-to-budget",
    title: "Empieza por el dinero disponible",
    description:
      "Este número te dice cuánto dinero real de tus cuentas aún puedes repartir entre categorías este mes.",
    accent: "Lo ideal es que lo lleves hacia cero asignando cada peso a una intención.",
    stat: "availableToBudget",
  },
  {
    id: "assigned",
    title: "Asignado = plan del mes",
    description:
      "En cada categoría escribes cuánto dinero quieres reservar. Ejemplo: comida, transporte o alquiler.",
    accent: "Asignar no significa gastar; significa separar dinero con propósito.",
    stat: "categories",
  },
  {
    id: "activity",
    title: "Actividad = lo que ya salió",
    description:
      "Aquí ves los egresos reales posteados del mes para esa categoría. Sirve para comparar plan vs ejecución.",
    accent: "Si gastas más de lo asignado, la categoría quedará en negativo.",
    stat: "month",
  },
  {
    id: "category-available",
    title: "Disponible = lo que queda",
    description:
      "Se calcula como asignado menos actividad. Es el saldo utilizable de la categoría antes de pasarte.",
    accent: "Si queda poco o está en rojo, conviene mover dinero desde otra categoría.",
    stat: "availableToBudget",
  },
  {
    id: "rollover",
    title: "Rollover para fondos reales",
    description:
      "Actívalo cuando quieras acumular saldo mes a mes, por ejemplo para mantenimiento, viajes o impuestos.",
    accent: "La meta te ayuda a saber cuánto deberías llegar a guardar en esa categoría.",
    stat: "month",
  },
] as const;

export function BudgetClient({
  profile,
  budgetMonth,
  budgetRows,
  availableToBudget,
}: BudgetClientProps) {
  const [isOnboardingOpen, setIsOnboardingOpen] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);

  React.useEffect(() => {
    const hasSeenOnboarding = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!hasSeenOnboarding) {
      setIsOnboardingOpen(true);
    }
  }, []);

  const closeOnboarding = React.useCallback(() => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setIsOnboardingOpen(false);
  }, []);

  const openOnboarding = React.useCallback(() => {
    setCurrentStep(0);
    setIsOnboardingOpen(true);
  }, []);

  const step = onboardingSteps[currentStep];
  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex">
      <Sidebar
        activeTab="budget"
        profile={profile}
        currency={profile.base_currency}
      />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 lg:py-12 space-y-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold">
                /presupuesto_mensual
              </span>
              <h1 className="font-heading-style text-3xl font-black tracking-tight lowercase">
                asignación por categorías
              </h1>
              <p className="text-xs text-muted-foreground font-mono max-w-2xl">
                Define objetivos, asigna dinero y revisa lo disponible por categoría.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start">
              <Button variant="outline" size="sm" onClick={openOnboarding}>
                cómo funciona
              </Button>
              <ThemeToggle />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border border-premium">
              <CardContent className="pt-0 space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">disponible para presupuestar</span>
                <p className="text-3xl font-mono font-bold">{formatMoney(availableToBudget, profile.base_currency)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border border-premium">
              <CardContent className="pt-0 space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">categorías activas</span>
                <p className="text-3xl font-mono font-bold">{budgetRows.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border border-premium">
              <CardContent className="pt-0 space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">mes presupuestado</span>
                <p className="text-3xl font-mono font-bold">{budgetMonth.month}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-accent-soft-border bg-accent-soft-bg/50">
            <CardContent className="pt-0 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-soft-fg">
                  guía rápida de uso
                </p>
                <p className="text-sm font-mono text-foreground">
                  Primero asigna dinero, luego registra gastos reales y revisa que cada categoría conserve saldo disponible.
                </p>
              </div>
              <Button variant="soft" onClick={openOnboarding}>
                ver onboarding
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider">
            <Link href="/dashboard"><Button variant="outline" size="sm">dashboard</Button></Link>
            <Link href="/dashboard/transactions"><Button variant="outline" size="sm">transacciones</Button></Link>
            <Link href="/dashboard/accounts"><Button variant="outline" size="sm">cuentas</Button></Link>
          </div>

          <div className="space-y-4">
            {budgetRows.map((row) => (
              <Card key={row.category.id} className="bg-card border border-premium">
                <CardContent className="pt-0">
                  <form action={setBudgetCategoryValue} className="grid grid-cols-1 lg:grid-cols-[1.2fr_repeat(4,1fr)_auto] gap-4 items-end font-mono text-xs">
                    <input type="hidden" name="budget_month_id" value={budgetMonth.id} />
                    <input type="hidden" name="category_id" value={row.category.id} />
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{row.category.group_name}</p>
                      <h2 className="font-heading-style text-lg font-bold lowercase">{row.category.name}</h2>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`assigned-${row.category.id}`}>Asignado</Label>
                      <Input id={`assigned-${row.category.id}`} name="assigned" type="number" step="0.01" defaultValue={row.assigned} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`target-${row.category.id}`}>Meta</Label>
                      <Input id={`target-${row.category.id}`} name="target_amount" type="number" step="0.01" defaultValue={row.target} />
                    </div>
                    <div className="space-y-1">
                      <Label>Actividad</Label>
                      <div className="h-10 rounded-xl border border-premium px-3 flex items-center bg-background text-destructive">
                        -{formatMoney(row.activity, profile.base_currency)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Disponible</Label>
                      <div className="h-10 rounded-xl border border-premium px-3 flex items-center bg-background">
                        {formatMoney(row.available, profile.base_currency)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                        <input type="checkbox" name="rollover_enabled" defaultChecked={row.rolloverEnabled} />
                        rollover
                      </label>
                      <Button type="submit" variant="soft">guardar</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {isOnboardingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-fade-in px-4">
          <Card className="w-full max-w-2xl bg-card border border-premium shadow-premium-lg relative animate-scale-up">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-soft-fg">
                    guía de presupuesto
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    paso {currentStep + 1} de {onboardingSteps.length}
                  </span>
                </div>
                <h3 className="font-heading-style text-2xl font-black lowercase">
                  {step.title}
                </h3>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={closeOnboarding} aria-label="Cerrar onboarding">
                <IconX className="size-4" />
              </Button>
            </div>

            <div className="space-y-5 font-mono text-xs">
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-soft-fg transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    {step.description}
                  </p>
                  <div className="rounded-2xl border border-accent-soft-border bg-accent-soft-bg/70 p-4">
                    <p className="text-accent-soft-fg leading-relaxed">
                      {step.accent}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {step.stat !== "availableToBudget" && (
                    <div className="rounded-2xl border border-premium bg-background p-4 space-y-3">
                      <div className="flex items-center gap-2 text-foreground">
                        <IconWallet className="size-4" />
                        <span className="uppercase tracking-wider text-[10px]">disponible para presupuestar</span>
                      </div>
                      <p className="text-2xl font-bold">{formatMoney(availableToBudget, profile.base_currency)}</p>
                    </div>
                  )}
                  {step.stat !== "categories" && (
                    <div className="rounded-2xl border border-premium bg-background p-4 space-y-3">
                      <div className="flex items-center gap-2 text-foreground">
                        <IconPigMoney className="size-4" />
                        <span className="uppercase tracking-wider text-[10px]">categorías listas</span>
                      </div>
                      <p className="text-2xl font-bold">{budgetRows.length}</p>
                    </div>
                  )}
                  {step.stat !== "month" && (
                    <div className="rounded-2xl border border-premium bg-background p-4 space-y-3">
                      <div className="flex items-center gap-2 text-foreground">
                        <IconTargetArrow className="size-4" />
                        <span className="uppercase tracking-wider text-[10px]">mes activo</span>
                      </div>
                      <p className="text-lg font-bold">{budgetMonth.month}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {onboardingSteps.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      currentStep === index
                        ? "border-accent-soft-border bg-accent-soft-bg text-accent-soft-fg"
                        : "border-premium bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="block text-[9px] uppercase tracking-wider">paso {index + 1}</span>
                    <span className="block mt-1 text-[10px] leading-snug">{item.title}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                  disabled={currentStep === 0}
                >
                  <IconArrowLeft className="size-4" />
                  anterior
                </Button>

                {currentStep === onboardingSteps.length - 1 ? (
                  <Button type="button" onClick={closeOnboarding}>
                    entendido
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep((prev) => Math.min(prev + 1, onboardingSteps.length - 1))}
                  >
                    siguiente
                    <IconArrowRight className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
