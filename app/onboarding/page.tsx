"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { submitOnboarding } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/select";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { useAccentTheme, AccentTheme } from "@/components/common/theme-context";
import { SubscriptionFrequencySelect } from "@/components/common/frequency-select";
import { CategoryLibraryInput } from "@/components/common/category-library-input";
import { IncomeRecurringFields } from "@/components/common/income-recurring-fields";
import { todayLocalIso } from "@/lib/finance/dates";
import { buildCategoryLibrary } from "@/lib/finance/recurring";
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
  day_of_month?: number;
  schedule_days?: number[];
}

interface SubscriptionItem {
  name: string;
  amount: number;
  billing_cycle: "daily" | "weekly" | "bi-weekly" | "monthly" | "yearly";
  category: string;
  next_payment_date: string;
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

function normalizeDays(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.max(1, Math.min(31, value))),
    ),
  ).sort((a, b) => a - b);
}

export default function OnboardingPage() {
  const router = useRouter();
  const { accentTheme, setAccentTheme } = useAccentTheme();
  const supabase = createClient();

  const [step, setStep] = React.useState<OnboardingStep>(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");

  const [incomesList, setIncomesList] = React.useState<IncomeItem[]>([]);
  const [subscriptionsList, setSubscriptionsList] = React.useState<
    SubscriptionItem[]
  >([]);
  const [subscriptionCategoryLibrary, setSubscriptionCategoryLibrary] =
    React.useState<string[]>(buildCategoryLibrary());

  const [incomeSource, setIncomeSource] = React.useState("");
  const [incomeAmount, setIncomeAmount] = React.useState("");
  const [incomeFreq, setIncomeFreq] = React.useState<
    "weekly" | "bi-weekly" | "monthly"
  >("monthly");
  const [incomePrimaryDay, setIncomePrimaryDay] = React.useState("1");
  const [incomeSecondaryDay, setIncomeSecondaryDay] = React.useState("15");

  const [subName, setSubName] = React.useState("");
  const [subAmount, setSubAmount] = React.useState("");
  const [subFreq, setSubFreq] = React.useState<
    "daily" | "weekly" | "bi-weekly" | "monthly"
  >("monthly");
  const [subCategory, setSubCategory] = React.useState("entretenimiento");
  const [subDate, setSubDate] = React.useState(todayLocalIso());

  const [selectedPlan, setSelectedPlan] = React.useState<"free" | "pro">(
    "free",
  );

  React.useEffect(() => {
    async function loadUserData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      if (user.user_metadata?.full_name) {
        setFullName(user.user_metadata.full_name);
      }

      const { data: categories } = await supabase
        .from("categories")
        .select("name, kind")
        .eq("user_id", user.id)
        .eq("kind", "expense");

      const fetchedNames = (categories ?? []).map(
        (category: { name: string }) => category.name,
      );
      setSubscriptionCategoryLibrary(buildCategoryLibrary(fetchedNames));
    }

    loadUserData();
  }, [supabase]);

  const translateFrequency = (freq: string) => {
    switch (freq) {
      case "daily":
        return "diario";
      case "weekly":
        return "semanal";
      case "bi-weekly":
        return "quincenal";
      case "monthly":
        return "mensual";
      case "yearly":
        return "anual";
      default:
        return freq;
    }
  };

  const getPhaseInfo = () => {
    switch (step) {
      case 1:
        return { phaseNum: 1, name: "nombre", pct: 12 };
      case 2:
        return { phaseNum: 2, name: "divisa", pct: 24 };
      case 3:
      case 4:
        return { phaseNum: 3, name: "ingresos", pct: 52 };
      case 5:
      case 6:
      case 7:
        return { phaseNum: 4, name: "suscripciones", pct: 80 };
      case 8:
        return { phaseNum: 5, name: "personalización", pct: 100 };
    }
  };

  const phase = getPhaseInfo();

  const formatIncomeSchedule = (income: IncomeItem) => {
    if (
      income.frequency !== "bi-weekly" ||
      !income.schedule_days ||
      income.schedule_days.length < 2
    ) {
      return translateFrequency(income.frequency);
    }

    return `quincenal · días ${income.schedule_days[0]} y ${income.schedule_days[1]}`;
  };

  const handleNameStep = () => {
    if (!fullName.trim()) {
      setError("Por favor, ingresa tu nombre.");
      return;
    }

    setError("");
    setStep(2);
  };

  const handleCurrencyStep = () => {
    if (!currency.trim()) {
      setError("Selecciona una divisa principal.");
      return;
    }

    setError("");
    setStep(3);
  };

  const handleAddIncome = () => {
    if (!incomeSource.trim() || !incomeAmount.trim()) {
      setError("Por favor, rellena todos los campos del ingreso.");
      return;
    }

    const amount = parseFloat(incomeAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setError("Ingresa una cantidad de ingreso válida.");
      return;
    }

    const scheduleDays =
      incomeFreq === "bi-weekly"
        ? normalizeDays([incomePrimaryDay, incomeSecondaryDay])
        : [];

    if (incomeFreq === "bi-weekly" && scheduleDays.length < 2) {
      setError("Para un ingreso quincenal debes elegir dos días distintos.");
      return;
    }

    setIncomesList((prev) => [
      ...prev,
      {
        source: incomeSource.trim(),
        amount,
        frequency: incomeFreq,
        day_of_month: Number.parseInt(incomePrimaryDay, 10) || 1,
        schedule_days: scheduleDays.length > 0 ? scheduleDays : undefined,
      },
    ]);

    setIncomeSource("");
    setIncomeAmount("");
    setIncomeFreq("monthly");
    setIncomePrimaryDay("1");
    setIncomeSecondaryDay("15");
    setError("");
    setStep(4);
  };

  const handleAddSubscription = () => {
    if (!subName.trim() || !subAmount.trim()) {
      setError("Por favor, rellena todos los campos de la suscripción.");
      return;
    }

    const amount = parseFloat(subAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setError("Ingresa un monto de suscripción válido.");
      return;
    }

    const normalizedCategory = (subCategory.trim() || "otros").toLowerCase();
    setSubscriptionsList((prev) => [
      ...prev,
      {
        name: subName.trim(),
        amount,
        billing_cycle: subFreq,
        category: normalizedCategory,
        next_payment_date: subDate,
      },
    ]);
    setSubscriptionCategoryLibrary((prev) =>
      buildCategoryLibrary([...prev, normalizedCategory]),
    );

    setSubName("");
    setSubAmount("");
    setSubFreq("monthly");
    setSubCategory("entretenimiento");
    setSubDate(todayLocalIso());
    setError("");
    setStep(7);
  };

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
        return;
      }

      if (selectedPlan === "pro") {
        router.push("/api/checkout/stripe?simulated=true&next=/welcome");
        return;
      }

      router.push("/welcome");
    } catch {
      setError("Ocurrió un error inesperado al guardar. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  const deleteIncomeFromList = (index: number) => {
    setIncomesList((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const deleteSubscriptionFromList = (index: number) => {
    setSubscriptionsList((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
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
        <div className="space-y-2 text-center md:text-left">
          <div className="flex justify-between items-center text-xs font-mono text-muted-foreground uppercase tracking-widest">
            <span>
              Fase {phase.phaseNum} de 5: {phase.name}
            </span>
            <span>{fullName ? fullName.toLowerCase() : "onboarding"}</span>
          </div>
          <div className="w-full h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-soft-fg transition-all duration-300"
              style={{ width: `${phase.pct}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 border border-destructive bg-destructive/5 text-destructive text-xs font-mono rounded-xl">
            {error}
          </div>
        )}

        <Card className="bg-background shadow-premium-lg overflow-hidden transition-all duration-300">
          <CardContent className="pt-0">
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                    /tu_nombre
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    Empecemos por lo más simple.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">¿Cómo te llamas?</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Ingresa tu nombre"
                    required
                  />
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleNameStep}
                    variant="soft"
                    className="w-full justify-center gap-2"
                  >
                    CONTINUAR <IconArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                    /tu_divisa
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    Esta será la moneda principal de tu experiencia financiera.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Divisa Principal</Label>
                  <FormSelect
                    id="currency"
                    value={currency}
                    onValueChange={setCurrency}
                    options={[
                      { value: "USD", label: "USD ($ - Dólar estadounidense)" },
                      { value: "EUR", label: "EUR (€ - Euro)" },
                      { value: "COP", label: "COP ($ - Peso colombiano)" },
                      { value: "MXN", label: "MXN ($ - Peso mexicano)" },
                      { value: "ARS", label: "ARS ($ - Peso argentino)" },
                    ]}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="gap-2"
                  >
                    <IconArrowLeft className="size-4" /> ATRÁS
                  </Button>
                  <Button
                    onClick={handleCurrencyStep}
                    variant="soft"
                    className="flex-1 justify-center gap-2"
                  >
                    CONTINUAR <IconArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <IconCoin className="size-5 text-accent-soft-fg" />
                    <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                      /agregar_ingreso
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    Tu arranque financiero visible en Zetsu empieza registrando
                    ingresos.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="incomeSource">
                      Nombre o Fuente del ingreso
                    </Label>
                    <Input
                      id="incomeSource"
                      value={incomeSource}
                      onChange={(event) => setIncomeSource(event.target.value)}
                      placeholder="Ej. Nómina principal, freelance"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incomeAmount">Monto ({currency})</Label>
                    <Input
                      id="incomeAmount"
                      type="number"
                      value={incomeAmount}
                      onChange={(event) => setIncomeAmount(event.target.value)}
                      placeholder="Ej. 2500"
                    />
                  </div>

                  <IncomeRecurringFields
                    frequency={incomeFreq}
                    onFrequencyChange={setIncomeFreq}
                    primaryDay={incomePrimaryDay}
                    onPrimaryDayChange={setIncomePrimaryDay}
                    secondaryDay={incomeSecondaryDay}
                    onSecondaryDayChange={setIncomeSecondaryDay}
                    frequencyId="incomeFreq"
                    primaryDayId="incomePrimaryDay"
                    secondaryDayId="incomeSecondaryDay"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setStep(2)}
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

            {step === 4 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                    /ingresos_registrados
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    Estos son tus ingresos registrados hasta el momento.
                  </p>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {incomesList.map((income, index) => (
                    <div
                      key={`${income.source}-${index}`}
                      className="flex justify-between items-center p-3 rounded-xl border border-premium bg-accent-soft-bg/30 font-mono text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-foreground">
                          {income.source}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Recibido de forma: {formatIncomeSchedule(income)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          +
                          {new Intl.NumberFormat("es-ES", {
                            style: "currency",
                            currency,
                          }).format(income.amount)}
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
                  <p className="text-xs font-medium font-mono text-muted-foreground">
                    ¿Tienes otro ingreso más que registrar?
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setStep(3)}
                      variant="outline"
                      className="flex-1 justify-center gap-2"
                    >
                      SÍ, AGREGAR OTRO <IconPlus className="size-4" />
                    </Button>
                    <Button
                      onClick={() => setStep(5)}
                      variant="soft"
                      className="flex-1 justify-center gap-2"
                    >
                      NO, CONTINUAR <IconArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <IconCreditCard className="size-5 text-accent-soft-fg" />
                    <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                      /suscripciones
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    ¿Quieres registrar tus suscripciones recurrentes ahora
                    mismo?
                  </p>
                </div>

                <div className="border border-dashed border-border p-4 rounded-xl bg-muted/5 space-y-2 font-mono text-[10px] text-muted-foreground">
                  <p className="font-bold text-foreground uppercase tracking-wide flex items-center gap-1">
                    <IconSparkles className="size-3 text-accent-soft-fg" />{" "}
                    Módulo de Suscripciones (PRO)
                  </p>
                  <p>
                    Puedes organizarlas desde una biblioteca de categorías y
                    dejar que Zetsu las materialice en tu historial.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setStep(4)}
                    variant="outline"
                    className="gap-2"
                  >
                    <IconArrowLeft className="size-4" /> ATRÁS
                  </Button>
                  <div className="flex-1 flex gap-3">
                    <Button
                      onClick={() => setStep(8)}
                      variant="outline"
                      className="flex-1 justify-center"
                    >
                      DESPUÉS
                    </Button>
                    <Button
                      onClick={() => setStep(6)}
                      variant="soft"
                      className="flex-1 justify-center"
                    >
                      SÍ, AGREGAR
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                    /agregar_suscripción
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
                      onChange={(event) => setSubName(event.target.value)}
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
                        onChange={(event) => setSubAmount(event.target.value)}
                        placeholder="Ej. 12.99"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subFreq">Frecuencia del cobro</Label>
                      <SubscriptionFrequencySelect
                        id="subFreq"
                        value={subFreq}
                        onChange={(event) =>
                          setSubFreq(
                            event.target.value as
                              | "daily"
                              | "weekly"
                              | "bi-weekly"
                              | "monthly",
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <CategoryLibraryInput
                      id="subCategory"
                      label="Categoría"
                      value={subCategory}
                      onChange={setSubCategory}
                      categories={subscriptionCategoryLibrary}
                      placeholder="Ej. software"
                      helperText="Puedes elegir una categoría sugerida o escribir una nueva."
                    />

                    <div className="space-y-2">
                      <Label htmlFor="subDate">Fecha del Próximo Cobro</Label>
                      <Input
                        id="subDate"
                        type="date"
                        value={subDate}
                        onChange={(event) => setSubDate(event.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setStep(5)}
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

            {step === 7 && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="font-heading-style text-2xl font-bold tracking-tight lowercase">
                    /suscripciones_añadidas
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    Resumen de tus suscripciones de cobro recurrente.
                  </p>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {subscriptionsList.map((subscription, index) => (
                    <div
                      key={`${subscription.name}-${index}`}
                      className="flex justify-between items-center p-3 rounded-xl border border-premium bg-accent-soft-bg/30 font-mono text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-foreground">
                          {subscription.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Cobro:{" "}
                          {translateFrequency(subscription.billing_cycle)} (
                          {subscription.category})
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-destructive">
                          -
                          {new Intl.NumberFormat("es-ES", {
                            style: "currency",
                            currency,
                          }).format(subscription.amount)}
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
                  <p className="text-xs font-mono font-medium text-muted-foreground">
                    ¿Tienes alguna otra suscripción que agregar?
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setStep(6)}
                      variant="outline"
                      className="flex-1 justify-center gap-2"
                    >
                      SÍ, AGREGAR OTRA <IconPlus className="size-4" />
                    </Button>
                    <Button
                      onClick={() => setStep(8)}
                      variant="soft"
                      className="flex-1 justify-center gap-2"
                    >
                      NO, CONTINUAR <IconArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 8 && (
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
                  <div className="space-y-2">
                    <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                      Color de Acento de la Interfaz
                    </Label>
                    <div className="flex items-center space-x-3 pt-1">
                      {themes.map((theme) => {
                        const isActive = accentTheme === theme.id;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => setAccentTheme(theme.id)}
                            className={`size-8 rounded-full ${theme.class} border-2 ${
                              isActive
                                ? "border-foreground scale-110 ring-4 ring-accent-soft-fg/20"
                                : "border-border hover:scale-105"
                            } transition-all duration-200 cursor-pointer`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                      Selecciona tu plan de Zetsu
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan("free")}
                        className={`text-left p-3 border rounded-2xl transition-all duration-200 ${
                          selectedPlan === "free"
                            ? "bg-accent-soft-bg border-accent-soft-border ring-1 ring-accent-soft-border"
                            : "bg-background border-premium hover:border-foreground/30"
                        }`}
                      >
                        <p className="font-mono text-[9px] font-bold text-muted-foreground uppercase">
                          Gratis
                        </p>
                        <p className="font-mono font-bold text-sm mt-0.5">
                          $0/mes
                        </p>
                      </button>

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
                        <p className="font-mono text-[9px] font-bold text-accent-soft-fg uppercase">
                          Pro
                        </p>
                        <p className="font-mono font-bold text-sm mt-0.5">
                          $9/mes
                        </p>
                      </button>
                    </div>

                    {selectedPlan === "free" &&
                      subscriptionsList.length > 0 && (
                        <p className="text-[9px] font-mono text-amber-600 dark:text-amber-400 mt-1">
                          [!] Has registrado suscripciones. Estarán bloqueadas
                          en el plan Gratis hasta que actualices a Pro.
                        </p>
                      )}
                  </div>

                  <div className="p-4 border border-accent-soft-border bg-accent-soft-bg rounded-2xl text-center space-y-1 mt-4">
                    <p className="font-heading-style text-base font-bold text-foreground">
                      ¡Bienvenido a Zetsu,{" "}
                      {fullName.split(" ")[0]?.toLowerCase() || "usuario"}!
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                      Tu perfil financiero está listo. Al finalizar se crearán
                      tus reglas iniciales y podrás entrar al dashboard.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() =>
                      setStep(subscriptionsList.length > 0 ? 7 : 5)
                    }
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
                      <>
                        ir a pagar <IconArrowRight className="size-4" />
                      </>
                    ) : (
                      <>
                        finalizar <IconCircleCheck className="size-4" />
                      </>
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
