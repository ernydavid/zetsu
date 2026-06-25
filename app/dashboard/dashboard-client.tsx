"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { useAccentTheme, AccentTheme } from "@/components/common/theme-context";
import { signout } from "@/app/auth/actions";
import { sileo } from "sileo";
import { IncomeFrequencySelect, SubscriptionFrequencySelect } from "@/components/common/frequency-select";
import {
  addIncome,
  deleteIncome,
  addPayment,
  togglePaymentStatus,
  deletePayment,
  addSubscription,
  deleteSubscription,
  editSubscription,
} from "@/app/dashboard/actions";
import {
  IconPlus,
  IconTrash,
  IconLogout,
  IconLock,
  IconChartBar,
  IconAlertCircle,
  IconCircleCheck,
  IconCoin,
  IconCreditCard,
  IconSparkles,
  IconHome,
  IconReceipt,
  IconSettings,
  IconX,
  IconLoader2,
  IconMenu2,
  IconPencil,
} from "@tabler/icons-react";

interface DashboardClientProps {
  profile: any;
  incomes: any[] | null;
  payments: any[] | null;
  subscriptions: any[];
  isPro: boolean;
  currency: string;
  totalIncome: number;
  totalPayments: number;
  totalSubscriptions: number;
  netBalance: number;
  errorMsg?: string;
  upgradeMsg?: string;
}

export function DashboardClient({
  profile,
  incomes = [],
  payments = [],
  subscriptions = [],
  isPro,
  currency,
  totalIncome,
  totalPayments,
  totalSubscriptions,
  netBalance,
  errorMsg,
  upgradeMsg,
}: DashboardClientProps) {
  const { accentTheme, setAccentTheme } = useAccentTheme();
  const [activeModal, setActiveModal] = React.useState<"income" | "payment" | "subscription" | null>(null);
  const [editingSubscription, setEditingSubscription] = React.useState<any | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const [deleteTarget, setDeleteTarget] = React.useState<{
    title: string;
    type: "income" | "payment" | "subscription";
    action: () => Promise<void>;
  } | null>(null);

  const [localError, setLocalError] = React.useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (errorMsg) {
      const decoded = decodeURIComponent(errorMsg);
      setLocalError(decoded);
      sileo.error({ title: decoded });
      const timer = setTimeout(() => {
        setLocalError(null);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", window.location.pathname);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  React.useEffect(() => {
    if (upgradeMsg) {
      let msg = "Tu suscripción premium ha sido activada con éxito.";
      if (upgradeMsg === "success") {
        msg = "¡Felicidades! Tu suscripción premium ha sido activada con éxito.";
      }
      setLocalSuccess(msg);
      sileo.success({ title: msg });
      const timer = setTimeout(() => {
        setLocalSuccess(null);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", window.location.pathname);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [upgradeMsg]);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(val);
  };

  const formatCompactMoney = (val: number) => {
    const absVal = Math.abs(val);
    const sign = val < 0 ? "-" : "";
    
    const formatter = new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency,
    });
    
    const parts = formatter.formatToParts(100);
    const currencySymbol = parts.find(p => p.type === 'currency')?.value || currency;
    const isSymbolPrefix = parts[0].type === 'currency';

    let numStr = "";
    if (absVal >= 1_000_000) {
      numStr = (absVal / 1_000_000).toFixed(2).replace(".", ",") + "M";
    } else if (absVal >= 1_000) {
      numStr = (absVal / 1_000).toFixed(1).replace(".", ",") + "K";
    } else {
      numStr = absVal.toFixed(2).replace(".", ",");
    }

    if (isSymbolPrefix) {
      return `${sign}${currencySymbol}${numStr}`;
    } else {
      return `${sign}${numStr} ${currencySymbol}`;
    }
  };

  // Math for SVG Donut Chart
  const totalExpenses = totalPayments + totalSubscriptions;
  let savingsPct = 0;
  let paymentsPct = 0;
  let subscriptionsPct = 0;

  if (totalIncome > 0) {
    if (totalIncome >= totalExpenses) {
      const net = totalIncome - totalExpenses;
      savingsPct = (net / totalIncome) * 100;
      paymentsPct = (totalPayments / totalIncome) * 100;
      subscriptionsPct = (totalSubscriptions / totalIncome) * 100;
    } else {
      const totalOut = totalPayments + totalSubscriptions;
      paymentsPct = (totalPayments / totalOut) * 100;
      subscriptionsPct = (totalSubscriptions / totalOut) * 100;
      savingsPct = 0;
    }
  } else {
    if (totalExpenses > 0) {
      paymentsPct = (totalPayments / totalExpenses) * 100;
      subscriptionsPct = (totalSubscriptions / totalExpenses) * 100;
      savingsPct = 0;
    } else {
      savingsPct = 100; // Empty state
    }
  }

  const radius = 70;
  const circumference = 2 * Math.PI * radius; // ~439.82

  const chartSegments = [
    { name: "Ahorro", percentage: savingsPct, color: "var(--accent-soft-fg)", opacity: 1 },
    { name: "Pagos", percentage: paymentsPct, color: "oklch(0.552 0.016 285.938)", opacity: 0.8 },
    { name: "Suscripciones", percentage: subscriptionsPct, color: "var(--accent-soft-fg)", opacity: 0.4 },
  ].filter((s) => s.percentage > 0);

  // Combine income + payments + subscriptions into chronological log
  const transactionsLog = [
    ...(incomes || []).map((inc) => ({
      id: inc.id,
      title: inc.source,
      type: "income" as const,
      amount: Number(inc.amount),
      date: new Date(inc.created_at || Date.now()),
      displayDate: inc.date || "Hoy",
      action: deleteIncome.bind(null, inc.id),
    })),
    ...(payments || []).map((pay) => ({
      id: pay.id,
      title: pay.title,
      type: "payment" as const,
      amount: -Number(pay.amount),
      date: new Date(pay.created_at || Date.now()),
      displayDate: pay.category || "Servicio",
      status: pay.status,
      action: deletePayment.bind(null, pay.id),
    })),
    ...(subscriptions || []).map((sub) => ({
      id: sub.id,
      title: sub.name,
      type: "subscription" as const,
      amount: -Number(sub.amount),
      date: new Date(sub.created_at || Date.now()),
      displayDate: "Suscripción",
      action: deleteSubscription.bind(null, sub.id),
      raw: sub,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const translateFrequency = (freq: string) => {
    switch (freq) {
      case "daily": return "día";
      case "weekly": return "sem";
      case "bi-weekly": return "quinc";
      case "monthly": return "mes";
      case "yearly": return "año";
      default: return freq;
    }
  };

  const upcomingEvents = [
    ...(subscriptions || []).map((sub) => ({
      id: sub.id,
      name: sub.name,
      amount: Number(sub.amount),
      date: new Date(sub.next_payment_date),
      type: "subscription" as const,
      displayFreq: translateFrequency(sub.billing_cycle),
    })),
    ...(payments || [])
      .filter((p) => p.status === "unpaid")
      .map((pay) => ({
        id: pay.id,
        name: pay.title,
        amount: Number(pay.amount),
        date: new Date(pay.due_date || Date.now()),
        type: "payment" as const,
        displayFreq: "manual",
      })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const getDaysLeftText = (dueDate: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `venció hace ${Math.abs(diffDays)}d`;
    }
    if (diffDays === 0) {
      return "vence hoy";
    }
    if (diffDays === 1) {
      return "mañana";
    }
    return `${diffDays} días rest.`;
  };

  // Themes list
  const themes: { id: AccentTheme; name: string; class: string }[] = [
    { id: "slate", name: "Slate", class: "bg-slate-400 dark:bg-slate-600" },
    { id: "lavender", name: "Lavender", class: "bg-violet-400 dark:bg-violet-600" },
    { id: "mint", name: "Mint", class: "bg-emerald-400 dark:bg-emerald-600" },
    { id: "sky", name: "Sky", class: "bg-sky-400 dark:bg-sky-600" },
    { id: "peach", name: "Peach", class: "bg-orange-400 dark:bg-orange-600" },
  ];

  const handleAction = async (
    actionFn: (fd: FormData) => Promise<void>,
    fd: FormData,
    successMessage: string
  ) => {
    startTransition(async () => {
      try {
        await actionFn(fd);
        sileo.success({ title: successMessage });
        setActiveModal(null);
      } catch (err: any) {
        if (err && err.digest && err.digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        sileo.error({ title: err.message || "Ocurrió un error inesperado" });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row font-sans">
      {/* 1. LEFT SIDEBAR NAVIGATION (Desktop) */}
      <aside className="w-64 border-r border-premium bg-card flex flex-col justify-between hidden lg:flex shrink-0">
        <div className="p-8 space-y-8">
          <div className="flex items-center space-x-3">
            <span className="font-heading-style text-2xl font-black tracking-tighter">
              zetsu<span className="text-accent-soft-fg font-serif">.</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 border border-accent-soft-border rounded-full bg-accent-soft-bg text-accent-soft-fg uppercase font-bold tracking-wider">
              {profile.billing_tier}
            </span>
          </div>

          <nav className="space-y-2">
            <Link
              href="/dashboard"
              className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-accent-soft-bg text-accent-soft-fg border border-accent-soft-border text-sm font-medium transition-all duration-200"
            >
              <IconHome className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">dashboard</span>
            </Link>

            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground cursor-not-allowed hover:bg-muted/10 transition-all duration-200">
              <span className="flex items-center space-x-3">
                <IconReceipt className="size-4" />
                <span className="font-mono uppercase tracking-wider text-xs">transacciones</span>
              </span>
              <IconLock className="size-3 text-muted-foreground/60" />
            </div>

            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground cursor-not-allowed hover:bg-muted/10 transition-all duration-200">
              <span className="flex items-center space-x-3">
                <IconChartBar className="size-4" />
                <span className="font-mono uppercase tracking-wider text-xs">proyecciones</span>
              </span>
              <IconLock className="size-3 text-muted-foreground/60" />
            </div>

            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground cursor-not-allowed hover:bg-muted/10 transition-all duration-200">
              <span className="flex items-center space-x-3">
                <IconSettings className="size-4" />
                <span className="font-mono uppercase tracking-wider text-xs">ajustes</span>
              </span>
              <IconLock className="size-3 text-muted-foreground/60" />
            </div>
          </nav>
        </div>

        {/* User Card at bottom */}
        <div className="p-6 border-t border-premium space-y-4">
          <div className="flex items-center space-x-3">
            <div className="size-9 rounded-full bg-accent-soft-bg border border-accent-soft-border text-accent-soft-fg flex items-center justify-center font-bold font-mono text-sm uppercase">
              {profile.full_name ? profile.full_name.substring(0, 2) : "US"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono font-bold truncate text-foreground">
                {profile.full_name.toLowerCase()}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">
                divisa: {currency}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <ThemeToggle />
            <form action={signout}>
              <Button size="xs" variant="outline" className="gap-1.5 font-mono text-[10px] uppercase">
                <IconLogout className="size-3" /> salir
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* 2. MOBILE HEADER & NAVIGATION */}
      <header className="lg:hidden border-b border-premium bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-2">
          <span className="font-heading-style text-xl font-black tracking-tighter">
            zetsu<span className="text-accent-soft-fg font-serif">.</span>
          </span>
          <span className="text-[9px] font-mono px-2 py-0.2 border border-accent-soft-border rounded-full bg-accent-soft-bg text-accent-soft-fg uppercase font-bold">
            {profile.billing_tier}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Abrir menú"
          >
            <IconMenu2 className="size-4" />
          </Button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex flex-col p-6 animate-fade-in">
          <div className="flex justify-between items-center mb-8">
            <span className="font-heading-style text-xl font-black tracking-tighter">zetsu.</span>
            <Button size="icon-sm" variant="outline" onClick={() => setIsMobileMenuOpen(false)}>
              <IconX className="size-4" />
            </Button>
          </div>

          <nav className="space-y-4 flex-1">
            <Link
              href="/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-accent-soft-bg text-accent-soft-fg border border-accent-soft-border text-sm font-medium"
            >
              <IconHome className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">dashboard</span>
            </Link>

            <div className="flex items-center justify-between px-4 py-3 rounded-xl text-muted-foreground opacity-60">
              <span className="flex items-center space-x-3">
                <IconReceipt className="size-4" />
                <span className="font-mono uppercase tracking-wider text-xs">transacciones (pro)</span>
              </span>
              <IconLock className="size-3" />
            </div>

            <div className="flex items-center justify-between px-4 py-3 rounded-xl text-muted-foreground opacity-60">
              <span className="flex items-center space-x-3">
                <IconChartBar className="size-4" />
                <span className="font-mono uppercase tracking-wider text-xs">proyecciones (pro)</span>
              </span>
              <IconLock className="size-3" />
            </div>
          </nav>

          <div className="border-t border-premium pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono font-bold">{profile.full_name.toLowerCase()}</p>
              <p className="text-[10px] text-muted-foreground font-mono">divisa: {currency}</p>
            </div>
            <form action={signout}>
              <Button size="sm" variant="outline" className="gap-1.5 uppercase font-mono text-[10px]">
                <IconLogout className="size-3.5" /> salir
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8 lg:py-12 grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Notification Banner */}
          {(localError || localSuccess) && (
            <div className="xl:col-span-12">
              {localError && (
                <div className="p-3 border border-destructive bg-destructive/5 text-destructive text-xs font-mono rounded-xl flex items-center gap-2">
                  <IconAlertCircle className="size-4 shrink-0" />
                  <span>[ERROR]: {localError}</span>
                </div>
              )}
              {localSuccess && (
                <div className="p-4 border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-xs font-mono rounded-xl flex items-center gap-2 font-bold uppercase tracking-wider">
                  <IconSparkles className="size-4 text-emerald-500 animate-pulse" />
                  <span>[!] {localSuccess}</span>
                </div>
              )}
            </div>
          )}

          {/* COLUMN 1: MAIN GRAPHICS & TRANSACTION LIST (xl:col-span-8) */}
          <section className="xl:col-span-8 space-y-8">
            {/* Header Greeting */}
            <div className="space-y-1">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold">
                /resumen_financiero
              </span>
              <h1 className="font-heading-style text-3xl font-black tracking-tight text-foreground lowercase">
                hola, {profile.full_name.split(" ")[0]}!
              </h1>
            </div>

            {/* Primary Net Balance Card */}
            <Card soft className="overflow-hidden">
              <CardContent className="pt-0 space-y-6">
                {/* Top Section: Net Balance */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-accent-soft-fg font-bold tracking-wider block">
                    balance libre neto
                  </span>
                  <p className="text-3xl md:text-4xl font-mono font-bold tracking-tighter text-foreground">
                    {formatMoney(netBalance)}
                  </p>
                  <span className="text-[9px] font-mono text-muted-foreground block">
                    disponible después de todos tus gastos y suscripciones del mes
                  </span>
                </div>

                {/* Separador */}
                <div className="border-t border-dashed border-accent-soft-border/50" />

                {/* Bottom Section: Income & Expenses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono text-accent-soft-fg font-bold tracking-wider block">
                      ingresos mensuales
                    </span>
                    <p className="text-xl md:text-2xl font-mono font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                      {formatMoney(totalIncome)}
                    </p>
                    <span className="text-[9px] font-mono text-muted-foreground block">
                      {incomes?.length || 0} fuentes activas
                    </span>
                  </div>

                  <div className="space-y-1 sm:border-l sm:border-dashed sm:border-accent-soft-border/50 sm:pl-6">
                    <span className="text-[10px] uppercase font-mono text-accent-soft-fg font-bold tracking-wider block">
                      egresos totales
                    </span>
                    <p className="text-xl md:text-2xl font-mono font-bold tracking-tight text-destructive">
                      -{formatMoney(totalExpenses)}
                    </p>
                    <span className="text-[9px] font-mono text-muted-foreground block">
                      gastos manuales + suscripciones
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Payments (Horizontal Row like the mockup) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-heading-style text-lg font-bold tracking-tight text-foreground lowercase">
                  /próximos pagos
                </h2>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">siguiente vencimiento</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {upcomingEvents.length === 0 ? (
                  <Card className="flex flex-col justify-center items-center text-center p-8 bg-background border border-dashed border-border min-h-[140px] col-span-2 rounded-2xl">
                    <p className="font-mono text-xs text-muted-foreground uppercase font-bold">[!] no hay pagos pendientes</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      Todo al día. Registra tus ingresos, pagos o suscripciones desde el menú rápido.
                    </p>
                  </Card>
                ) : (
                  upcomingEvents.slice(0, 2).map((event, index) => {
                    const isFirst = index === 0;
                    const initials = event.name.substring(0, 2).toUpperCase();
                    return (
                      <Card
                        key={event.id}
                        soft={isFirst}
                        className="flex flex-col justify-between min-h-[140px] hover:shadow-premium-lg transition-all duration-200"
                      >
                        <div className="flex justify-between items-start">
                          <div className={`size-10 rounded-full flex items-center justify-center font-bold text-sm font-mono uppercase ${
                            isFirst
                              ? "bg-background border border-accent-soft-border/30 text-accent-soft-fg"
                              : "bg-muted/20 border border-border text-muted-foreground"
                          }`}>
                            {initials}
                          </div>
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 border rounded-full uppercase ${
                            isFirst
                              ? "border-accent-soft-border/30 bg-background/50 text-accent-soft-fg"
                              : "border-border bg-muted/10 text-muted-foreground"
                          }`}>
                            {event.type === "subscription" ? "recurrente" : "pendiente"}
                          </span>
                        </div>
                        <div className="mt-4">
                          <p className="font-heading-style text-base font-bold text-foreground truncate">{event.name}</p>
                          <div className="flex justify-between items-end mt-1">
                            <p className="text-xs font-mono text-muted-foreground">
                              <span className="font-bold text-foreground">{formatMoney(event.amount)}</span>
                              {event.type === "subscription" && `/${event.displayFreq}`}
                            </p>
                            <p className={`text-[10px] font-mono font-bold ${
                              isFirst ? "text-accent-soft-fg animate-pulse" : "text-muted-foreground"
                            }`}>
                              [{getDaysLeftText(event.date)}]
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>

            {/* Transactions Log Section */}
            <div className="space-y-4">
              <h2 className="font-heading-style text-lg font-bold tracking-tight text-foreground lowercase">
                /transacciones recientes
              </h2>

              <Card className="bg-background shadow-premium p-0 overflow-hidden">
                <div className="divide-y divide-border/60">
                  {transactionsLog.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground font-mono text-xs">
                      No hay transacciones registradas. Registra un ingreso o un pago para comenzar.
                    </div>
                  ) : (
                    transactionsLog.slice(0, 10).map((tx) => (
                      <div
                        key={tx.id}
                        className={`flex items-center justify-between p-4 hover:bg-muted/5 transition-colors ${
                          tx.type === "payment" && tx.status === "paid" ? "opacity-60" : ""
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className={`size-8 rounded-full flex items-center justify-center font-bold text-xs font-mono uppercase ${
                            tx.type === "income"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : tx.type === "subscription"
                              ? "bg-accent-soft-bg text-accent-soft-fg border border-accent-soft-border/30"
                              : "bg-muted/20 text-muted-foreground border border-border"
                          }`}>
                            {tx.title.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-mono font-bold text-foreground truncate">
                              {tx.title}
                            </p>
                            <p className="text-[9px] text-muted-foreground font-mono uppercase">
                              {tx.displayDate}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <span className={`text-xs font-mono font-bold ${
                            tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                          }`}>
                            {tx.type === "income" ? "+" : "-"}
                            {formatMoney(Math.abs(tx.amount))}
                          </span>

                          {tx.type === "payment" && (
                            <button
                              type="button"
                              onClick={() => {
                                startTransition(async () => {
                                  try {
                                    await togglePaymentStatus(tx.id, tx.status || "unpaid");
                                    sileo.success({
                                      title: `Pago marcado como ${
                                        tx.status === "paid" ? "pendiente" : "pagado"
                                      }`,
                                    });
                                  } catch (err: any) {
                                    if (err && err.digest && err.digest.startsWith("NEXT_REDIRECT")) {
                                      throw err;
                                    }
                                    sileo.error({ title: err.message || "Error al actualizar estado" });
                                  }
                                });
                              }}
                              className={`text-[9px] font-mono px-2 py-0.5 border ${
                                tx.status === "paid"
                                  ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5 font-bold"
                                  : "border-border text-muted-foreground"
                              } rounded-md hover:opacity-80 transition-opacity`}
                              disabled={isPending}
                            >
                              {tx.status === "paid" ? "PAGADO" : "PENDIENTE"}
                            </button>
                          )}

                          {tx.type === "subscription" && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSubscription(tx.raw);
                                setActiveModal("subscription");
                              }}
                              className="text-muted-foreground hover:text-accent-soft-fg p-1 transition-colors"
                              aria-label="Editar"
                            >
                              <IconPencil className="size-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget({
                                title: tx.title,
                                type: tx.type,
                                action: tx.action,
                              });
                            }}
                            className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                            aria-label="Eliminar"
                            disabled={isPending}
                          >
                            <IconTrash className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </section>

          {/* COLUMN 2: DONUT CHART, QUICK MENU, THEME SELECTOR (xl:col-span-4) */}
          <section className="xl:col-span-4 space-y-8">
            {/* SVG Donut Chart Activity Card */}
            <Card className="bg-background shadow-premium">
              <CardContent className="pt-0 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-heading-style font-bold text-sm lowercase">/actividad</h3>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold">mensual</span>
                </div>

                <div className="relative size-56 mx-auto flex items-center justify-center">
                  <svg width="220" height="220" viewBox="0 0 200 200" className="transform -rotate-90">
                    <circle
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="transparent"
                      stroke="var(--border)"
                      strokeWidth="20"
                      opacity="0.2"
                    />
                    {renderedSegments(chartSegments, radius, circumference)}
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold font-mono tracking-tighter">
                      {formatCompactMoney(netBalance)}
                    </span>
                    <span className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider mt-1">
                      ahorro libre
                    </span>
                  </div>
                </div>

                {/* Donut Legend */}
                <div className="grid grid-cols-3 gap-2 border-t border-dashed border-border pt-4 text-center font-mono text-[10px]">
                  <div className="space-y-1">
                    <span className="inline-block size-2 rounded-full bg-accent-soft-fg" />
                    <p className="text-muted-foreground">Ahorros</p>
                    <p className="font-bold text-foreground">{savingsPct.toFixed(0)}%</p>
                  </div>
                  <div className="space-y-1">
                    <span className="inline-block size-2 rounded-full bg-muted-foreground" />
                    <p className="text-muted-foreground">Gastos</p>
                    <p className="font-bold text-foreground">{paymentsPct.toFixed(0)}%</p>
                  </div>
                  <div className="space-y-1">
                    <span className="inline-block size-2 rounded-full bg-accent-soft-fg opacity-40" />
                    <p className="text-muted-foreground">Suscrip.</p>
                    <p className="font-bold text-foreground">{subscriptionsPct.toFixed(0)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Menu Actions */}
            <div className="space-y-3">
              <h3 className="font-heading-style text-sm font-bold text-foreground lowercase">
                /menú rápido
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setActiveModal("income")}
                  className="flex flex-col items-center justify-center p-4 border border-premium bg-card hover:bg-accent-soft-bg hover:border-accent-soft-border text-muted-foreground hover:text-accent-soft-fg rounded-2xl transition-all duration-200 group text-center cursor-pointer"
                >
                  <IconCoin className="size-5 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider">ingreso</span>
                </button>

                <button
                  onClick={() => setActiveModal("payment")}
                  className="flex flex-col items-center justify-center p-4 border border-premium bg-card hover:bg-accent-soft-bg hover:border-accent-soft-border text-muted-foreground hover:text-accent-soft-fg rounded-2xl transition-all duration-200 group text-center cursor-pointer"
                >
                  <IconCreditCard className="size-5 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider">pago</span>
                </button>

                <button
                  onClick={() => {
                    if (isPro) {
                      setEditingSubscription(null);
                      setActiveModal("subscription");
                    } else {
                      // Pro Upgrade simulation trigger
                      window.location.href = "/api/checkout/stripe?simulated=true";
                    }
                  }}
                  className="flex flex-col items-center justify-center p-4 border border-premium bg-card hover:bg-accent-soft-bg hover:border-accent-soft-border text-muted-foreground hover:text-accent-soft-fg rounded-2xl transition-all duration-200 group relative text-center cursor-pointer"
                >
                  {!isPro && <IconLock className="size-3 text-muted-foreground/60 absolute top-2 right-2" />}
                  <IconSparkles className="size-5 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider">suscrip.</span>
                </button>
              </div>
            </div>

            {/* Smart saving recommendations or locked projections */}
            <Card className="bg-background shadow-premium border border-dashed border-border p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <IconSparkles className="size-4 text-accent-soft-fg animate-pulse" />
                  <h3 className="font-heading-style font-bold text-xs lowercase">/proyección inteligente</h3>
                </div>

                {isPro ? (
                  <div className="space-y-3 font-mono text-[10px] leading-relaxed">
                    <p className="text-muted-foreground">
                      Tu capacidad de ahorro acumulada en base al balance libre neto actual:
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2 border border-premium rounded-xl bg-card">
                        <span className="text-muted-foreground block uppercase text-[8px]">En 3 meses</span>
                        <span className="font-bold text-foreground">{formatMoney(netBalance * 3)}</span>
                      </div>
                      <div className="p-2 border border-premium rounded-xl bg-card">
                        <span className="text-muted-foreground block uppercase text-[8px]">En 12 meses</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(netBalance * 12)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-center">
                    <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                      Proyecciones de balance futuro y alertas inteligentes bloqueadas.
                    </p>
                    <Link href="/api/checkout/stripe?simulated=true">
                      <Button variant="soft" size="xs" className="text-[9px] tracking-wider uppercase font-mono w-full justify-center">
                        actualizar a pro ($9/mes)
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </Card>

            {/* Theme Settings: Soft Accents Picker */}
            <Card className="bg-background shadow-premium">
              <CardContent className="pt-0 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-heading-style font-bold text-xs lowercase">/personalizar_acento</h3>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Aplica un matiz de color suave a botones, gráficos y tarjetas destacadas.
                  </p>
                </div>

                <div className="flex items-center space-x-3 pt-1">
                  {themes.map((theme) => {
                    const isActive = accentTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => setAccentTheme(theme.id)}
                        className={`size-6 rounded-full ${theme.class} border ${
                          isActive
                            ? "border-foreground scale-110 ring-2 ring-foreground/20"
                            : "border-border hover:scale-105"
                        } transition-all duration-200 cursor-pointer`}
                        aria-label={`Acento ${theme.name}`}
                        title={theme.name}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      {/* 4. MODALS OVERLAYS FOR ADDING DATA */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-fade-in px-4">
          <Card className="max-w-md w-full bg-card border border-premium shadow-premium-lg relative animate-scale-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-heading-style text-lg font-bold tracking-tight text-foreground lowercase">
                /{activeModal === "income" ? "registrar_ingreso" : activeModal === "payment" ? "registrar_pago" : editingSubscription ? "editar_suscripcion" : "registrar_suscripcion"}
              </h3>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setActiveModal(null)}
                aria-label="Cerrar modal"
              >
                <IconX className="size-4" />
              </Button>
            </div>

            {activeModal === "income" && (
              <form
                action={(fd) => handleAction(addIncome, fd, "Ingreso registrado con éxito")}
                className="space-y-4 font-mono text-xs"
              >
                <div className="space-y-1">
                  <Label htmlFor="modal-source" className="text-[10px] font-bold uppercase">Fuente de Ingreso</Label>
                  <Input id="modal-source" name="source" placeholder="Nómina Mensual" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="modal-income-amount" className="text-[10px] font-bold uppercase">Monto ({currency})</Label>
                    <Input id="modal-income-amount" name="amount" type="number" step="0.01" placeholder="2500" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="modal-income-freq" className="text-[10px] font-bold uppercase">Frecuencia</Label>
                    <IncomeFrequencySelect id="modal-income-freq" name="frequency" defaultValue="monthly" />
                  </div>
                </div>
                <div className="pt-2 flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 justify-center py-2"
                    onClick={() => setActiveModal(null)}
                    disabled={isPending}
                  >
                    cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="soft"
                    className="flex-1 justify-center py-2 gap-1.5"
                    disabled={isPending}
                  >
                    {isPending ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconPlus className="size-3.5" />}
                    agregar
                  </Button>
                </div>
              </form>
            )}

            {activeModal === "payment" && (
              <form
                action={(fd) => handleAction(addPayment, fd, "Pago registrado con éxito")}
                className="space-y-4 font-mono text-xs"
              >
                <div className="space-y-1">
                  <Label htmlFor="modal-title" className="text-[10px] font-bold uppercase">Título del Gasto</Label>
                  <Input id="modal-title" name="title" placeholder="Internet Fibra" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="modal-pay-amount" className="text-[10px] font-bold uppercase">Monto ({currency})</Label>
                    <Input id="modal-pay-amount" name="amount" type="number" step="0.01" placeholder="45" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="modal-category" className="text-[10px] font-bold uppercase">Categoría</Label>
                    <Input id="modal-category" name="category" placeholder="servicios" defaultValue="servicios" />
                  </div>
                </div>
                <div className="pt-2 flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 justify-center py-2"
                    onClick={() => setActiveModal(null)}
                    disabled={isPending}
                  >
                    cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="soft"
                    className="flex-1 justify-center py-2 gap-1.5"
                    disabled={isPending}
                  >
                    {isPending ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconPlus className="size-3.5" />}
                    agregar
                  </Button>
                </div>
              </form>
            )}

            {activeModal === "subscription" && (
              <form
                key={editingSubscription ? `edit-${editingSubscription.id}` : "new"}
                action={(fd) => handleAction(
                  editingSubscription ? editSubscription : addSubscription,
                  fd,
                  editingSubscription ? "Suscripción actualizada con éxito" : "Suscripción registrada con éxito"
                )}
                className="space-y-4 font-mono text-xs"
              >
                {editingSubscription && (
                  <input type="hidden" name="id" value={editingSubscription.id} />
                )}
                <div className="space-y-1">
                  <Label htmlFor="modal-sub-name" className="text-[10px] font-bold uppercase">Nombre del Servicio</Label>
                  <Input
                    id="modal-sub-name"
                    name="name"
                    placeholder="Spotify Premium"
                    defaultValue={editingSubscription?.name || ""}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="modal-sub-amount" className="text-[10px] font-bold uppercase">Monto ({currency})</Label>
                    <Input
                      id="modal-sub-amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      placeholder="10.99"
                      defaultValue={editingSubscription?.amount || ""}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="modal-sub-category" className="text-[10px] font-bold uppercase">Categoría</Label>
                    <Input
                      id="modal-sub-category"
                      name="category"
                      placeholder="entretenimiento"
                      defaultValue={editingSubscription?.category || "entretenimiento"}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="modal-sub-freq" className="text-[10px] font-bold uppercase">Frecuencia de Cobro</Label>
                    <SubscriptionFrequencySelect
                      id="modal-sub-freq"
                      name="billing_cycle"
                      defaultValue={editingSubscription?.billing_cycle || "monthly"}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="modal-sub-date" className="text-[10px] font-bold uppercase">Próximo Cobro</Label>
                    <Input
                      id="modal-sub-date"
                      name="next_payment_date"
                      type="date"
                      defaultValue={
                        editingSubscription?.next_payment_date
                          ? editingSubscription.next_payment_date.split("T")[0]
                          : new Date().toISOString().split("T")[0]
                      }
                      required
                    />
                  </div>
                </div>
                <div className="pt-2 flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 justify-center py-2"
                    onClick={() => setActiveModal(null)}
                    disabled={isPending}
                  >
                    cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="soft"
                    className="flex-1 justify-center py-2 gap-1.5"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <IconLoader2 className="size-3.5 animate-spin" />
                    ) : editingSubscription ? (
                      <IconPencil className="size-3.5" />
                    ) : (
                      <IconPlus className="size-3.5" />
                    )}
                    {editingSubscription ? "guardar" : "agregar"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-fade-in px-4">
          <Card className="max-w-sm w-full bg-card border border-premium shadow-premium-lg relative animate-scale-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading-style text-sm font-bold tracking-tight text-foreground lowercase flex items-center gap-1.5">
                <IconAlertCircle className="size-4 text-destructive" />
                /confirmar_eliminacion
              </h3>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                aria-label="Cerrar modal"
                disabled={isPending}
              >
                <IconX className="size-4" />
              </Button>
            </div>
            
            <div className="space-y-4 font-mono text-xs">
              <p className="text-muted-foreground leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente el/la {deleteTarget.type === "income" ? "ingreso" : deleteTarget.type === "payment" ? "pago" : "suscripción"}:{" "}
                <span className="text-foreground font-bold font-mono">"{deleteTarget.title}"</span>? Esta acción no se puede deshacer.
              </p>
              
              <div className="pt-2 flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 justify-center py-2"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isPending}
                >
                  cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1 justify-center py-2 gap-1.5"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await deleteTarget.action();
                        sileo.success({ title: "Registro eliminado con éxito" });
                        setDeleteTarget(null);
                      } catch (err: any) {
                        if (err && err.digest && err.digest.startsWith("NEXT_REDIRECT")) {
                          throw err;
                        }
                        sileo.error({ title: err.message || "Error al eliminar" });
                      }
                    });
                  }}
                  disabled={isPending}
                >
                  {isPending ? (
                    <IconLoader2 className="size-3.5 animate-spin" />
                  ) : (
                    <IconTrash className="size-3.5" />
                  )}
                  eliminar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Donut Segment Helper to compute offsets properly
function renderedSegments(
  segments: { percentage: number; color: string; opacity: number }[],
  radius: number,
  circumference: number
) {
  let currentCumulative = 0;
  return segments.map((seg, idx) => {
    const dasharray = `${(seg.percentage / 100) * circumference} ${circumference}`;
    const dashoffset = -((currentCumulative / 100) * circumference);
    currentCumulative += seg.percentage;
    return (
      <circle
        key={idx}
        cx="100"
        cy="100"
        r={radius}
        fill="transparent"
        stroke={seg.color}
        strokeWidth="20"
        strokeDasharray={dasharray}
        strokeDashoffset={dashoffset}
        className="transition-all duration-500 ease-in-out"
        opacity={seg.opacity}
        style={{ transformOrigin: "center" }}
      />
    );
  });
}
