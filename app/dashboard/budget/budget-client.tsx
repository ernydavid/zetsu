"use client";

import * as React from "react";
import { AnimatedModal } from "@/components/common/animated-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sidebar } from "@/components/common/sidebar";
import { HelpIconButton } from "@/components/common/help-icon-button";
import { setBudgetCategoryValue, upsertBudgetPlan } from "@/app/dashboard/actions";
import type { FinanceProfile } from "@/lib/finance/types";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconLayoutCards,
  IconPlus,
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
  availableAfterDebtMinimums: number;
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
  availableAfterDebtMinimums,
}: BudgetClientProps) {
  const [isOnboardingOpen, setIsOnboardingOpen] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isWizardOpen, setIsWizardOpen] = React.useState(false);
  const [wizardStep, setWizardStep] = React.useState(0);
  const [expandedCategoryId, setExpandedCategoryId] = React.useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>([]);
  const [draftValues, setDraftValues] = React.useState<
    Record<string, { assigned: string; target: string; rolloverEnabled: boolean }>
  >({});

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
  const activeRows = budgetRows.filter(
    (row) => row.assigned > 0 || row.target > 0 || row.activity > 0 || row.rolloverEnabled,
  );
  const groupedActiveRows = activeRows.reduce<Record<string, BudgetRow[]>>((acc, row) => {
    const key = row.category.group_name;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(row);
    return acc;
  }, {});
  const activeGroups = Object.entries(groupedActiveRows);
  const wizardCategories = selectedCategoryIds
    .map((categoryId) => budgetRows.find((row) => row.category.id === categoryId))
    .filter(Boolean) as BudgetRow[];

  const openWizard = React.useCallback(() => {
    const initialIds = activeRows.map((row) => row.category.id);
    const initialDrafts = budgetRows.reduce<
      Record<string, { assigned: string; target: string; rolloverEnabled: boolean }>
    >((acc, row) => {
      acc[row.category.id] = {
        assigned: String(row.assigned || ""),
        target: String(row.target || ""),
        rolloverEnabled: row.rolloverEnabled,
      };
      return acc;
    }, {});

    setSelectedCategoryIds(initialIds);
    setDraftValues(initialDrafts);
    setWizardStep(0);
    setIsWizardOpen(true);
  }, [activeRows, budgetRows]);

  const toggleCategorySelection = React.useCallback((categoryId: string) => {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }, []);

  const updateDraftValue = React.useCallback(
    (categoryId: string, field: "assigned" | "target" | "rolloverEnabled", value: string | boolean) => {
      setDraftValues((current) => ({
        ...current,
        [categoryId]: {
          assigned: current[categoryId]?.assigned ?? "",
          target: current[categoryId]?.target ?? "",
          rolloverEnabled: current[categoryId]?.rolloverEnabled ?? true,
          [field]: value,
        },
      }));
    },
    [],
  );

  const wizardItemsPayload = JSON.stringify(
    wizardCategories.map((row) => ({
      category_id: row.category.id,
      assigned: Number.parseFloat(draftValues[row.category.id]?.assigned || "0") || 0,
      target_amount: Number.parseFloat(draftValues[row.category.id]?.target || "0") || 0,
      rollover_enabled: draftValues[row.category.id]?.rolloverEnabled ?? true,
    })),
  );

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
              <h1 className="font-heading-style text-3xl font-black tracking-tight text-accent-soft-fg lowercase">
                presupuesto activo
              </h1>
              <p className="text-xs text-muted-foreground font-mono max-w-2xl">
                Crea tu plan mensual en pasos y revisa solo las categorías que realmente están en juego.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start">
              <Button variant="soft" size="sm" onClick={openWizard}>
                <IconPlus className="size-4" />
                nuevo presupuesto
              </Button>
              <HelpIconButton onClick={openOnboarding} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border border-premium">
              <CardContent className="pt-0 space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">disponible para presupuestar</span>
                <p className="text-3xl font-mono font-bold">{formatMoney(availableToBudget, profile.base_currency)}</p>
                <p className="text-[10px] font-mono text-amber-600">
                  tras cuotas de deuda: {formatMoney(availableAfterDebtMinimums, profile.base_currency)}
                </p>
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
                  plan en foco
                </p>
                <p className="text-sm font-mono text-foreground">
                  Trabaja solo con categorías activas. Si quieres abrir nuevas, añádelas desde el flujo guiado.
                </p>
              </div>
              <Button variant="outline" onClick={openWizard}>
                editar plan
              </Button>
            </CardContent>
          </Card>

          {activeRows.length === 0 ? (
            <Card className="border-dashed border-accent-soft-border bg-accent-soft-bg/40">
              <CardContent className="pt-0 text-center space-y-4">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-accent-soft-border bg-background/70">
                  <IconLayoutCards className="size-6 text-accent-soft-fg" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-heading-style text-2xl font-black lowercase">
                    ningún presupuesto activo
                  </h2>
                  <p className="text-xs font-mono text-muted-foreground max-w-xl mx-auto">
                    Empieza con un flujo guiado para elegir categorías, asignar montos y definir metas mensuales.
                  </p>
                </div>
                <Button variant="soft" onClick={openWizard}>
                  <IconPlus className="size-4" />
                  crear presupuesto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeGroups.map(([groupName, rows]) => (
                <Card key={groupName} className="bg-card border border-premium overflow-hidden">
                  <CardContent className="pt-0 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-soft-fg">
                          grupo activo
                        </p>
                        <h2 className="font-heading-style text-xl font-black lowercase">
                          {groupName}
                        </h2>
                      </div>
                      <span className="rounded-full border border-premium bg-background px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {rows.length} categorías
                      </span>
                    </div>

                    <div className="space-y-2">
                      {rows.map((row) => {
                        const isExpanded = expandedCategoryId === row.category.id;
                        return (
                          <div key={row.category.id} className="rounded-2xl border border-premium bg-background/80 overflow-hidden">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCategoryId((current) =>
                                  current === row.category.id ? null : row.category.id,
                                )
                              }
                              className="w-full px-4 py-3 text-left"
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="space-y-1 min-w-0">
                                  <p className="font-heading-style text-lg font-bold lowercase truncate">
                                    {row.category.name}
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider">
                                    <span className="text-muted-foreground">asignado {formatMoney(row.assigned, profile.base_currency)}</span>
                                    <span className="text-muted-foreground">actividad {formatMoney(row.activity, profile.base_currency)}</span>
                                    <span className={`${row.available >= 0 ? "text-foreground" : "text-destructive"}`}>
                                      disponible {formatMoney(row.available, profile.base_currency)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`rounded-full border px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.18em] ${
                                    row.available >= 0
                                      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                                      : "border-destructive/20 bg-destructive/5 text-destructive"
                                  }`}>
                                    {row.available >= 0 ? "en rango" : "en rojo"}
                                  </span>
                                  <span className="flex size-8 items-center justify-center rounded-full border border-premium bg-background text-muted-foreground transition-all duration-300">
                                    {isExpanded ? (
                                      <IconChevronUp className="size-4" />
                                    ) : (
                                      <IconChevronDown className="size-4" />
                                    )}
                                  </span>
                                </div>
                              </div>
                            </button>

                            <div
                              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                                isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                              }`}
                            >
                              <div className="overflow-hidden">
                                <form
                                  action={setBudgetCategoryValue}
                                  className={`border-t border-premium px-4 py-4 space-y-3 font-mono text-xs bg-muted/10 transition-all duration-300 ease-out ${
                                    isExpanded
                                      ? "opacity-100 translate-y-0"
                                      : "opacity-0 -translate-y-2 pointer-events-none"
                                  }`}
                                >
                                  <input type="hidden" name="budget_month_id" value={budgetMonth.id} />
                                  <input type="hidden" name="category_id" value={row.category.id} />
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <Label htmlFor={`assigned-${row.category.id}`}>Asignado</Label>
                                      <Input id={`assigned-${row.category.id}`} name="assigned" type="number" step="0.01" defaultValue={row.assigned} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label htmlFor={`target-${row.category.id}`}>Meta</Label>
                                      <Input id={`target-${row.category.id}`} name="target_amount" type="number" step="0.01" defaultValue={row.target} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label>Rollover</Label>
                                      <label className="flex h-10 items-center gap-2 rounded-xl border border-premium bg-background px-3 text-[10px] uppercase tracking-wider">
                                        <input type="checkbox" name="rollover_enabled" defaultChecked={row.rolloverEnabled} />
                                        mantener saldo
                                      </label>
                                    </div>
                                  </div>
                                  <div className="flex justify-end">
                                    <Button type="submit" variant="soft">guardar ajuste</Button>
                                  </div>
                                </form>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {isWizardOpen && (
        <AnimatedModal
          open={isWizardOpen}
          overlayClassName="flex items-center justify-center bg-background/80 backdrop-blur-md px-4"
          panelClassName="w-full max-w-4xl"
        >
          <Card className="w-full max-w-4xl bg-card border border-premium shadow-premium-lg relative">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-soft-fg">
                    nuevo presupuesto
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    paso {wizardStep + 1} de 3
                  </span>
                </div>
                <h3 className="font-heading-style text-2xl font-black lowercase">
                  {wizardStep === 0
                    ? "elige categorías"
                    : wizardStep === 1
                    ? "asigna montos"
                    : "revisa tu plan"}
                </h3>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={() => setIsWizardOpen(false)} aria-label="Cerrar wizard">
                <IconX className="size-4" />
              </Button>
            </div>

            <div className="space-y-5 font-mono text-xs">
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-soft-fg transition-all duration-300"
                  style={{ width: `${((wizardStep + 1) / 3) * 100}%` }}
                />
              </div>

              {wizardStep === 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Selecciona solo las categorías que quieres activar en este plan mensual.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {budgetRows.map((row) => {
                      const isSelected = selectedCategoryIds.includes(row.category.id);
                      return (
                        <button
                          key={row.category.id}
                          type="button"
                          onClick={() => toggleCategorySelection(row.category.id)}
                          className={`rounded-2xl border p-4 text-left transition-all ${
                            isSelected
                              ? "border-accent-soft-border bg-accent-soft-bg text-accent-soft-fg"
                              : "border-premium bg-background text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[9px] uppercase tracking-[0.18em]">{row.category.group_name}</p>
                              <p className="mt-2 text-lg font-heading-style font-bold lowercase">
                                {row.category.name}
                              </p>
                            </div>
                            {isSelected && <IconCheck className="size-4 shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {wizardStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Define cuánto quieres asignar y cuál es la meta de cada categoría activa.
                  </p>
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {wizardCategories.map((row) => (
                      <div key={row.category.id} className="rounded-2xl border border-premium bg-background p-4 grid gap-3 md:grid-cols-[1fr_0.8fr_0.8fr_auto] md:items-end">
                        <div className="space-y-1">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{row.category.group_name}</p>
                          <p className="font-heading-style text-lg font-bold lowercase">{row.category.name}</p>
                        </div>
                        <div className="space-y-1">
                          <Label>Asignado</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={draftValues[row.category.id]?.assigned ?? ""}
                            onChange={(event) => updateDraftValue(row.category.id, "assigned", event.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Meta</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={draftValues[row.category.id]?.target ?? ""}
                            onChange={(event) => updateDraftValue(row.category.id, "target", event.target.value)}
                          />
                        </div>
                        <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={draftValues[row.category.id]?.rolloverEnabled ?? true}
                            onChange={(event) => updateDraftValue(row.category.id, "rolloverEnabled", event.target.checked)}
                          />
                          rollover
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Este es el plan que se va a activar para el mes actual.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {wizardCategories.map((row) => (
                      <div key={row.category.id} className="rounded-2xl border border-premium bg-background p-4 space-y-2">
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{row.category.group_name}</p>
                          <p className="font-heading-style text-lg font-bold lowercase">{row.category.name}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <p className="text-muted-foreground uppercase">asignado</p>
                            <p className="font-bold">{formatMoney(Number.parseFloat(draftValues[row.category.id]?.assigned || "0") || 0, profile.base_currency)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground uppercase">meta</p>
                            <p className="font-bold">{formatMoney(Number.parseFloat(draftValues[row.category.id]?.target || "0") || 0, profile.base_currency)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (wizardStep === 0) {
                      setIsWizardOpen(false);
                      return;
                    }
                    setWizardStep((prev) => Math.max(prev - 1, 0));
                  }}
                >
                  <IconArrowLeft className="size-4" />
                  {wizardStep === 0 ? "cerrar" : "anterior"}
                </Button>

                {wizardStep === 2 ? (
                  <form action={upsertBudgetPlan}>
                    <input type="hidden" name="budget_month_id" value={budgetMonth.id} />
                    <input type="hidden" name="items" value={wizardItemsPayload} />
                    <Button type="submit" variant="soft">
                      activar presupuesto
                    </Button>
                  </form>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 0 && selectedCategoryIds.length === 0) {
                        return;
                      }
                      setWizardStep((prev) => Math.min(prev + 1, 2));
                    }}
                    disabled={wizardStep === 0 && selectedCategoryIds.length === 0}
                  >
                    siguiente
                    <IconArrowRight className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </AnimatedModal>
      )}

      {isOnboardingOpen && (
        <AnimatedModal
          open={isOnboardingOpen}
          overlayClassName="flex items-center justify-center bg-background/80 backdrop-blur-md px-4"
          panelClassName="w-full max-w-2xl"
        >
          <Card className="w-full max-w-2xl bg-card border border-premium shadow-premium-lg relative">
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
        </AnimatedModal>
      )}
    </div>
  );
}
