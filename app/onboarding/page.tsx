"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { submitOnboarding } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { useAccentTheme, AccentTheme } from "@/components/common/theme-context";
import { IncomeFrequencySelect, SubscriptionFrequencySelect } from "@/components/common/frequency-select";
import {
  IconArrowRight,
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconCircleCheck,
  IconSparkles,
  IconCoin,
  IconCreditCard,
  IconPalette,
} from "@tabler/icons-react";

interface IncomeItem {
  source: string;
  amount: number;
  frequency: "weekly" | "bi-weekly" | "monthly" | "one-time";
}

interface SubscriptionItem {
  name: string;
  amount: number;
  billing_cycle: "daily" | "weekly" | "bi-weekly" | "monthly" | "yearly";
  category: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { accentTheme, setAccentTheme } = useAccentTheme();
  
  // Steps:
  // 1: Personal Details (Name, Currency)
  // 2: Add Income Form
  // 3: Income Loop confirmation ("¿Tienes otro ingreso?")
  // 4: Subscription opt-in question ("¿Deseas agregar suscripciones?")
  // 5: Add Subscription Form
  // 6: Subscription Loop confirmation ("¿Tienes otra suscripción?")
  // 7: Theme, Billing Tier & Final Welcome
  const [step, setStep] = React.useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");

  // Collected Lists
  const [incomesList, setIncomesList] = React.useState<IncomeItem[]>([]);
  const [subscriptionsList, setSubscriptionsList] = React.useState<SubscriptionItem[]>([]);

  // Current Input States
  const [incomeSource, setIncomeSource] = React.useState("");
  const [incomeAmount, setIncomeAmount] = React.useState("");
  const [incomeFreq, setIncomeFreq] = React.useState<"weekly" | "bi-weekly" | "monthly">("monthly");

  const [subName, setSubName] = React.useState("");
  const [subAmount, setSubAmount] = React.useState("");
  const [subFreq, setSubFreq] = React.useState<"daily" | "weekly" | "bi-weekly" | "monthly">("monthly");
  const [subCategory, setSubCategory] = React.useState("entretenimiento");
  const [subDate, setSubDate] = React.useState(new Date().toISOString().split("T")[0]);

  const [selectedPlan, setSelectedPlan] = React.useState<"free" | "pro">("free");

  const supabase = createClient();

  React.useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        if (user.user_metadata?.full_name) {
          setFullName(user.user_metadata.full_name);
        }
      }
    }
    loadUser();
  }, [supabase]);

  // Translate frequencies for displaying nicely in loops
  const translateFrequency = (freq: string) => {
    switch (freq) {
      case "daily": return "diario";
      case "weekly": return "semanal";
      case "bi-weekly": return "quincenal";
      case "monthly": return "mensual";
      case "yearly": return "anual";
      default: return freq;
    }
  };

  const getPhaseInfo = () => {
    switch (step) {
      case 1:
        return { phaseNum: 1, name: "perfil", pct: 20 };
      case 2:
      case 3:
        return { phaseNum: 2, name: "ingresos", pct: 50 };
      case 4:
      case 5:
      case 6:
        return { phaseNum: 3, name: "suscripciones", pct: 80 };
      case 7:
        return { phaseNum: 4, name: "personalización", pct: 100 };
    }
  };

  const phase = getPhaseInfo();

  // Step 1: Personal Details validation
  const handleStep1Submit = () => {
    if (!fullName.trim()) {
      setError("Por favor, ingresa tu nombre.");
      return;
    }
    setError("");
    setStep(2);
  };

  // Step 2: Add Income validation
  const handleAddIncome = () => {
    if (!incomeSource.trim() || !incomeAmount.trim()) {
      setError("Por favor, rellena todos los campos del ingreso.");
      return;
    }
    const amt = parseFloat(incomeAmount);
    if (isNaN(amt) || amt <= 0) {
      setError("Ingresa una cantidad de ingreso válida.");
      return;
    }

    setIncomesList((prev) => [
      ...prev,
      { source: incomeSource.trim(), amount: amt, frequency: incomeFreq },
    ]);

    // Reset fields
    setIncomeSource("");
    setIncomeAmount("");
    setIncomeFreq("monthly");
    setError("");

    // Advance to Step 3 (Loop ask)
    setStep(3);
  };

  // Step 5: Add Subscription validation
  const handleAddSubscription = () => {
    if (!subName.trim() || !subAmount.trim()) {
      setError("Por favor, rellena todos los campos de la suscripción.");
      return;
    }
    const amt = parseFloat(subAmount);
    if (isNaN(amt) || amt <= 0) {
      setError("Ingresa un monto de suscripción válido.");
      return;
    }

    setSubscriptionsList((prev) => [
      ...prev,
      {
        name: subName.trim(),
        amount: amt,
        billing_cycle: subFreq,
        category: subCategory.trim() || "entretenimiento",
        next_payment_date: subDate,
      },
    ]);

    // Reset fields
    setSubName("");
    setSubAmount("");
    setSubFreq("monthly");
    setSubCategory("entretenimiento");
    setSubDate(new Date().toISOString().split("T")[0]);
    setError("");

    // Advance to Step 6 (Loop ask)
    setStep(6);
  };

  // Submit everything to the database
  const handleSubmitAll = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await submitOnboarding({
        fullName,
        currency,
        incomes: incomesList,
        subscriptions: subscriptionsList,
        billingTier: selectedPlan,
      });

      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        if (selectedPlan === "pro") {
          // Redirect to stripe mock checkout
          router.push("/api/checkout/stripe?simulated=true");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err: any) {
      setError("Ocurrió un error inesperado al guardar. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  // Delete handlers inside the loop summary screens
  const deleteIncomeFromList = (index: number) => {
    setIncomesList((prev) => prev.filter((_, i) => i !== index));
  };

  const deleteSubscriptionFromList = (index: number) => {
    setSubscriptionsList((prev) => prev.filter((_, i) => i !== index));
  };

  const themes: { id: AccentTheme; class: string }[] = [
    { id: "slate", class: "bg-slate-400 dark:bg-slate-600" },
    { id: "lavender", class: "bg-violet-400 dark:bg-violet-600" },
    { id: "mint", class: "bg-emerald-400 dark:bg-emerald-600" },
    { id: "sky", class: "bg-sky-400 dark:bg-sky-600" },
    { id: "peach", class: "bg-orange-400 dark:bg-orange-600" },
  ];

  return (
    <main className="flex-1 flex flex-col justify-center items-center min-h-screen p-4 md:p-8 bg-background relative">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[500px] space-y-8">
        {/* Onboarding Header */}
        <div className="space-y-2 text-center md:text-left">
          <div className="flex justify-between items-center text-xs font-mono text-muted-foreground uppercase tracking-widest">
            <span>Fase {phase.phaseNum} de 4: {phase.name}</span>
            <span>{fullName ? fullName.toLowerCase() : "onboarding"}</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-soft-fg transition-all duration-300"
              style={{ width: `${phase.pct}%` }}
            ></div>
          </div>
        </div>

        {error && (
          <div className="p-3 border border-destructive bg-destructive/5 text-destructive text-xs font-mono rounded-xl">
            {error}
          </div>
        )}

        <Card className="bg-background shadow-premium-lg overflow-hidden transition-all duration-300">
          <CardContent className="pt-0">
            {/* STEP 1: Personal Details */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                    /sobre ti
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    Comencemos por configurar los datos básicos de tu cuenta.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">¿Cómo te llamas?</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ingresa tu nombre"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Divisa Principal</Label>
                    <div className="relative">
                      <select
                        id="currency"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="flex h-10 w-full bg-background px-3 py-2 text-sm rounded-xl border border-premium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground font-mono transition-colors appearance-none cursor-pointer"
                      >
                        <option value="USD">USD ($ - Dólar estadounidense)</option>
                        <option value="EUR">EUR (€ - Euro)</option>
                        <option value="COP">COP ($ - Peso colombiano)</option>
                        <option value="MXN">MXN ($ - Peso mexicano)</option>
                        <option value="ARS">ARS ($ - Peso argentino)</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground font-mono text-xs border-l border-border">
                        ▼
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleStep1Submit}
                    variant="soft"
                    className="w-full justify-center gap-2"
                  >
                    CONTINUAR <IconArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Add Income Form */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <IconCoin className="size-5 text-accent-soft-fg" />
                    <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                      /agregar ingreso
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    Registra una de tus fuentes de ingresos para calcular tu balance neto.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="incomeSource">Nombre o Fuente del ingreso</Label>
                    <Input
                      id="incomeSource"
                      value={incomeSource}
                      onChange={(e) => setIncomeSource(e.target.value)}
                      placeholder="Ej. Nómina Principal, Trabajo Freelance"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="incomeAmount">Monto ({currency})</Label>
                      <Input
                        id="incomeAmount"
                        type="number"
                        value={incomeAmount}
                        onChange={(e) => setIncomeAmount(e.target.value)}
                        placeholder="Ej. 2500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="incomeFreq">¿Cada cuánto lo recibes?</Label>
                      <IncomeFrequencySelect
                        id="incomeFreq"
                        value={incomeFreq}
                        onChange={(e) => setIncomeFreq(e.target.value as any)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setError("");
                      if (incomesList.length > 0) {
                        setStep(3); // Go back to summary if we have items
                      } else {
                        setStep(1);
                      }
                    }}
                    variant="outline"
                    className="gap-2"
                  >
                    <IconArrowLeft className="size-4" /> ATRÁS
                  </Button>
                  <Button
                    onClick={handleAddIncome}
                    variant="soft"
                    className="flex-1 justify-center gap-2"
                  >
                    GUARDAR INGRESO <IconPlus className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Income loop summary / "¿Tienes otro ingreso?" */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                    /ingresos registrados
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    Estos son tus ingresos registrados hasta el momento.
                  </p>
                </div>

                {/* Incomes Summary List */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {incomesList.map((inc, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 rounded-xl border border-premium bg-accent-soft-bg/30 font-mono text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-foreground">{inc.source}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Recibido de forma: {translateFrequency(inc.frequency)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          +{new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(inc.amount)}
                        </span>
                        <button
                          onClick={() => deleteIncomeFromList(index)}
                          className="text-muted-foreground hover:text-destructive p-1 transition-colors cursor-pointer"
                          title="Eliminar"
                        >
                          <IconTrash className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-border pt-4 text-center space-y-4">
                  <p className="text-sm font-medium">¿Tienes otro ingreso más que registrar?</p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setStep(2)}
                      variant="outline"
                      className="flex-1 justify-center gap-2"
                    >
                      SÍ, AGREGAR OTRO <IconPlus className="size-4" />
                    </Button>
                    <Button
                      onClick={() => setStep(4)}
                      variant="soft"
                      className="flex-1 justify-center gap-2"
                    >
                      NO, CONTINUAR <IconArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Subscription Opt-in Choice */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <IconCreditCard className="size-5 text-accent-soft-fg" />
                    <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                      /suscripciones
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    ¿Quieres registrar tus suscripciones recurrentes (como Netflix, Spotify, etc.) ahora mismo?
                  </p>
                </div>

                <div className="border border-dashed border-border p-4 rounded-xl bg-muted/5 space-y-2 font-mono text-[10px] text-muted-foreground">
                  <p className="font-bold text-foreground uppercase tracking-wide flex items-center gap-1">
                    <IconSparkles className="size-3 text-accent-soft-fg" /> Módulo de Suscripciones (PRO)
                  </p>
                  <p>
                    Zetsu te ayuda a centralizar tus débitos mensuales de entretenimiento y software de forma automática.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setStep(3)}
                    variant="outline"
                    className="gap-2"
                  >
                    <IconArrowLeft className="size-4" /> ATRÁS
                  </Button>
                  <div className="flex-1 flex gap-3">
                    <Button
                      onClick={() => setStep(7)} // Skip
                      variant="outline"
                      className="flex-1 justify-center"
                    >
                      DESPUÉS
                    </Button>
                    <Button
                      onClick={() => setStep(5)} // Add now
                      variant="soft"
                      className="flex-1 justify-center"
                    >
                      SÍ, AGREGAR
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Add Subscription Form */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                    /agregar suscripción
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    Introduce los detalles de tu suscripción de pago.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subName">Nombre del servicio</Label>
                    <Input
                      id="subName"
                      value={subName}
                      onChange={(e) => setSubName(e.target.value)}
                      placeholder="Ej. Netflix, Spotify, Gimnasio"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subAmount">Costo ({currency})</Label>
                      <Input
                        id="subAmount"
                        type="number"
                        value={subAmount}
                        onChange={(e) => setSubAmount(e.target.value)}
                        placeholder="Ej. 12.99"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subFreq">Frecuencia del cobro</Label>
                      <SubscriptionFrequencySelect
                        id="subFreq"
                        value={subFreq}
                        onChange={(e) => setSubFreq(e.target.value as any)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subCategory">Categoría</Label>
                      <Input
                        id="subCategory"
                        value={subCategory}
                        onChange={(e) => setSubCategory(e.target.value)}
                        placeholder="Ej. entretenimiento, software, salud"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subDate">Fecha del Próximo Cobro</Label>
                      <Input
                        id="subDate"
                        type="date"
                        value={subDate}
                        onChange={(e) => setSubDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setError("");
                      if (subscriptionsList.length > 0) {
                        setStep(6);
                      } else {
                        setStep(4);
                      }
                    }}
                    variant="outline"
                    className="gap-2"
                  >
                    <IconArrowLeft className="size-4" /> ATRÁS
                  </Button>
                  <Button
                    onClick={handleAddSubscription}
                    variant="soft"
                    className="flex-1 justify-center gap-2"
                  >
                    GUARDAR SUSCRIPCIÓN <IconPlus className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 6: Subscription Loop summary */}
            {step === 6 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                    /suscripciones añadidas
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    Resumen de tus suscripciones de cobro recurrente.
                  </p>
                </div>

                {/* Subscriptions summary list */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {subscriptionsList.map((sub, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 rounded-xl border border-premium bg-accent-soft-bg/30 font-mono text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-foreground">{sub.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Cobro: {translateFrequency(sub.billing_cycle)} ({sub.category})
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-destructive">
                          -{new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(sub.amount)}
                        </span>
                        <button
                          onClick={() => deleteSubscriptionFromList(index)}
                          className="text-muted-foreground hover:text-destructive p-1 transition-colors cursor-pointer"
                          title="Eliminar"
                        >
                          <IconTrash className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-border pt-4 text-center space-y-4">
                  <p className="text-sm font-medium">¿Tienes alguna otra suscripción de pago que agregar?</p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setStep(5)}
                      variant="outline"
                      className="flex-1 justify-center gap-2"
                    >
                      SÍ, AGREGAR OTRA <IconPlus className="size-4" />
                    </Button>
                    <Button
                      onClick={() => setStep(7)}
                      variant="soft"
                      className="flex-1 justify-center gap-2"
                    >
                      NO, CONTINUAR <IconArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7: Theme, Billing Tier & Final Welcome */}
            {step === 7 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <IconPalette className="size-5 text-accent-soft-fg" />
                    <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                      /ajustes_finales
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    Personaliza la estética de tu interfaz y selecciona tu plan.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Theme Accent Picker */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                      Color de Acento de la Interfaz
                    </Label>
                    <div className="flex items-center space-x-3 pt-1">
                      {themes.map((t) => {
                        const isActive = accentTheme === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setAccentTheme(t.id)}
                            className={`size-8 rounded-full ${t.class} border-2 ${
                              isActive
                                ? "border-foreground scale-110 ring-4 ring-accent-soft-fg/20"
                                : "border-border hover:scale-105"
                            } transition-all duration-200 cursor-pointer`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Plan Picker */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                      Selecciona tu plan de Zetsu
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Free Plan */}
                      <button
                        type="button"
                        onClick={() => setSelectedPlan("free")}
                        className={`text-left p-3 border rounded-2xl transition-all duration-200 ${
                          selectedPlan === "free"
                            ? "bg-accent-soft-bg border-accent-soft-border ring-1 ring-accent-soft-border"
                            : "bg-background border-premium hover:border-foreground/30"
                        }`}
                      >
                        <p className="font-mono text-[9px] font-bold text-muted-foreground uppercase">Gratis</p>
                        <p className="font-mono font-bold text-sm mt-0.5">$0/mes</p>
                      </button>

                      {/* Pro Plan */}
                      <button
                        type="button"
                        onClick={() => setSelectedPlan("pro")}
                        className={`text-left p-3 border rounded-2xl relative transition-all duration-200 ${
                          selectedPlan === "pro"
                            ? "bg-accent-soft-bg border-accent-soft-border ring-1 ring-accent-soft-border"
                            : "bg-background border-premium hover:border-foreground/30"
                        }`}
                      >
                        <span className="absolute top-2 right-2 bg-foreground text-background font-mono text-[8px] px-1 py-0.2 rounded-md font-bold">
                          PRO
                        </span>
                        <p className="font-mono text-[9px] font-bold text-accent-soft-fg uppercase">Pro</p>
                        <p className="font-mono font-bold text-sm mt-0.5">$9/mes</p>
                      </button>
                    </div>

                    {selectedPlan === "free" && subscriptionsList.length > 0 && (
                      <p className="text-[9px] font-mono text-amber-600 dark:text-amber-400 mt-1">
                        [!] Has registrado suscripciones. Estarán bloqueadas en el plan Gratis hasta que actualices a Pro.
                      </p>
                    )}
                  </div>

                  {/* Welcome Message Card */}
                  <div className="p-4 border border-accent-soft-border bg-accent-soft-bg rounded-2xl text-center space-y-1 mt-4">
                    <p className="font-heading-style text-base font-bold text-foreground">
                      ¡Bienvenido a Zetsu, {fullName.split(" ")[0].toLowerCase()}!
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                      Tu entorno financiero está listo. Al hacer clic en finalizar se guardarán tus datos y se inicializará tu dashboard.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => {
                      if (subscriptionsList.length > 0) {
                        setStep(6);
                      } else {
                        setStep(4);
                      }
                    }}
                    variant="outline"
                    className="gap-2"
                    disabled={loading}
                  >
                    <IconArrowLeft className="size-4" /> ATRÁS
                  </Button>
                  <Button
                    onClick={handleSubmitAll}
                    variant="soft"
                    className="flex-1 justify-center gap-2 font-mono uppercase"
                    disabled={loading}
                  >
                    {loading ? (
                      "procesando..."
                    ) : selectedPlan === "pro" ? (
                      <>ir a pagar <IconArrowRight className="size-4" /></>
                    ) : (
                      <>finalizar <IconCircleCheck className="size-4" /></>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
