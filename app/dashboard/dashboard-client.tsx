"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { AppLogo } from "@/components/common/app-logo";
import { AnimatedModal } from "@/components/common/animated-modal";
import { Sidebar } from "@/components/common/sidebar";
import { CategoryLibraryInput } from "@/components/common/category-library-input";
import { IncomeRecurringFields } from "@/components/common/income-recurring-fields";
import { todayLocalIso } from "@/lib/finance/dates";
import { signout } from "@/app/auth/actions";
import { sileo } from "sileo";
import { SubscriptionFrequencySelect } from "@/components/common/frequency-select";
import {
  addIncome,
  deleteIncome,
  editIncome,
  addPayment,
  togglePaymentStatus,
  deletePayment,
  deleteSubscription,
  editSubscription,
} from "@/app/dashboard/actions";
import {
  IconArrowLeft,
  IconArrowRight,
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
  expenseCategoryLibrary: string[];
  isPro: boolean;
  currency: string;
  availableBalance: number;
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  availableToBudget: number;
  availableAfterDebtMinimums: number;
  totalDebtOutstanding: number;
  debtMinimums: number;
  projectedCashflow: number;
  runwayDays: number | null;
  errorMsg?: string;
  upgradeMsg?: string;
  startTour?: boolean;
}

const DASHBOARD_TOUR_STORAGE_KEY = "zetsu-dashboard-tour-seen-v1";
type TourTargetKey =
  | "sidebarDashboard"
  | "balanceCard"
  | "transactionsSection"
  | "quickMenu";

type TourRect = { top: number; left: number; width: number; height: number };

export function DashboardClient({
  profile,
  incomes = [],
  payments = [],
  subscriptions = [],
  expenseCategoryLibrary,
  isPro,
  currency,
  availableBalance,
  netWorth,
  monthlyIncome,
  monthlyExpenses,
  availableToBudget,
  availableAfterDebtMinimums,
  totalDebtOutstanding,
  debtMinimums,
  projectedCashflow,
  runwayDays,
  errorMsg,
  upgradeMsg,
  startTour = false,
}: DashboardClientProps) {
  const [activeModal, setActiveModal] = React.useState<
    "income" | "payment" | "subscription" | null
  >(null);
  const [editingSubscription, setEditingSubscription] = React.useState<
    any | null
  >(null);
  const [editingIncome, setEditingIncome] = React.useState<any | null>(null);
  const [isIncomeRecurring, setIsIncomeRecurring] = React.useState(false);
  const [isExpenseRecurring, setIsExpenseRecurring] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [statusPendingId, setStatusPendingId] = React.useState<string | null>(
    null,
  );

  const [deleteTarget, setDeleteTarget] = React.useState<{
    title: string;
    type: "income" | "payment" | "subscription";
    action: () => Promise<void>;
  } | null>(null);

  const [incomeFrequency, setIncomeFrequency] =
    React.useState<string>("monthly");
  const [expenseFrequency, setExpenseFrequency] =
    React.useState<string>("monthly");
  const [incomeDay, setIncomeDay] = React.useState<string>("");
  const [incomeSecondaryDay, setIncomeSecondaryDay] =
    React.useState<string>("");
  const [expenseDay, setExpenseDay] = React.useState<string>("");
  const [subscriptionCategoryValue, setSubscriptionCategoryValue] =
    React.useState("servicios");

  React.useEffect(() => {
    if (editingIncome) {
      setIsIncomeRecurring(true);
      setIncomeFrequency(editingIncome.frequency || "monthly");
      if (
        editingIncome.frequency === "bi-weekly" &&
        Array.isArray(editingIncome.schedule_days)
      ) {
        setIncomeDay(String(editingIncome.schedule_days[0] ?? 1));
        setIncomeSecondaryDay(String(editingIncome.schedule_days[1] ?? 15));
      } else if (editingIncome.next_pay_date) {
        const d = new Date(editingIncome.next_pay_date);
        setIncomeDay(String(d.getUTCDate()));
        setIncomeSecondaryDay("15");
      } else {
        setIncomeDay(String(new Date().getUTCDate()));
        setIncomeSecondaryDay("15");
      }
    } else {
      setIsIncomeRecurring(false);
      setIncomeFrequency("monthly");
      setIncomeDay(String(new Date().getUTCDate()));
      setIncomeSecondaryDay("15");
    }
  }, [editingIncome]);

  React.useEffect(() => {
    if (editingSubscription) {
      setIsExpenseRecurring(true);
      setExpenseFrequency(editingSubscription.billing_cycle || "monthly");
      setSubscriptionCategoryValue(editingSubscription.category || "servicios");
      if (editingSubscription.next_payment_date) {
        const d = new Date(editingSubscription.next_payment_date);
        const day = d.getUTCDate();
        const baseDay =
          editingSubscription.billing_cycle === "bi-weekly"
            ? day > 15
              ? day - 15
              : day
            : day;
        setExpenseDay(String(baseDay));
      } else {
        setExpenseDay(String(new Date().getUTCDate()));
      }
    } else {
      setIsExpenseRecurring(false);
      setExpenseFrequency("monthly");
      setExpenseDay(String(new Date().getUTCDate()));
      setSubscriptionCategoryValue("servicios");
    }
  }, [editingSubscription]);

  React.useEffect(() => {
    if (expenseFrequency === "bi-weekly") {
      const parsed = parseInt(expenseDay);
      if (!isNaN(parsed) && parsed > 15) {
        setExpenseDay("15");
      }
    }
  }, [expenseFrequency, expenseDay]);

  const [localError, setLocalError] = React.useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = React.useState<string | null>(null);
  const [isTourOpen, setIsTourOpen] = React.useState(false);
  const [tourStep, setTourStep] = React.useState(0);
  const [tourRects, setTourRects] = React.useState<
    Partial<Record<TourTargetKey, TourRect>>
  >({});
  const mainScrollRef = React.useRef<HTMLElement | null>(null);
  const sidebarDashboardRef = React.useRef<HTMLAnchorElement | null>(null);
  const balanceCardRef = React.useRef<HTMLDivElement | null>(null);
  const transactionsSectionRef = React.useRef<HTMLDivElement | null>(null);
  const quickMenuRef = React.useRef<HTMLDivElement | null>(null);

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
        msg =
          "¡Felicidades! Tu suscripción premium ha sido activada con éxito.";
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

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hasSeenTour = window.localStorage.getItem(DASHBOARD_TOUR_STORAGE_KEY);
    if (startTour || !hasSeenTour) {
      setTourStep(0);
      setIsTourOpen(true);
    }
  }, [startTour]);

  const updateTourLayout = React.useCallback(() => {
    const nextRects: Partial<Record<TourTargetKey, TourRect>> = {};
    const entries: Array<[TourTargetKey, React.RefObject<HTMLElement | null>]> =
      [
        ["sidebarDashboard", sidebarDashboardRef],
        ["balanceCard", balanceCardRef],
        ["transactionsSection", transactionsSectionRef],
        ["quickMenu", quickMenuRef],
      ];

    for (const [key, ref] of entries) {
      const node = ref.current;
      if (!node) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      nextRects[key] = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    }

    setTourRects(nextRects);
  }, []);

  const getTourTargetNode = React.useCallback((target: TourTargetKey) => {
    const targetMap: Record<TourTargetKey, HTMLElement | null> = {
      sidebarDashboard: sidebarDashboardRef.current,
      balanceCard: balanceCardRef.current,
      transactionsSection: transactionsSectionRef.current,
      quickMenu: quickMenuRef.current,
    };

    return targetMap[target];
  }, []);

  React.useEffect(() => {
    if (!isTourOpen) {
      return;
    }

    updateTourLayout();

    const handleViewportChange = () => updateTourLayout();
    const scrollNode = mainScrollRef.current;

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    scrollNode?.addEventListener("scroll", handleViewportChange);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      scrollNode?.removeEventListener("scroll", handleViewportChange);
    };
  }, [isTourOpen, updateTourLayout]);

  React.useEffect(() => {
    if (!isTourOpen) {
      return;
    }

    const activeStep = dashboardTourSteps[tourStep];
    const targetNode = activeStep ? getTourTargetNode(activeStep.target) : null;

    targetNode?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    const timer = window.setTimeout(() => {
      updateTourLayout();
    }, 260);

    return () => window.clearTimeout(timer);
  }, [getTourTargetNode, isTourOpen, tourStep, updateTourLayout]);

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
    const currencySymbol =
      parts.find((p) => p.type === "currency")?.value || currency;
    const isSymbolPrefix = parts[0].type === "currency";

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
  const chartAvailable = Math.max(availableToBudget, 0);
  const chartProjectedOutflows = Math.max(-projectedCashflow, 0);
  const totalExpenses = monthlyExpenses + chartProjectedOutflows;
  let savingsPct = 0;
  let paymentsPct = 0;
  let subscriptionsPct = 0;

  const incomeForChart =
    chartAvailable + monthlyExpenses + chartProjectedOutflows;

  if (incomeForChart > 0) {
    if (incomeForChart >= totalExpenses) {
      const net = chartAvailable;
      savingsPct = (net / incomeForChart) * 100;
      paymentsPct = (monthlyExpenses / incomeForChart) * 100;
      subscriptionsPct = (chartProjectedOutflows / incomeForChart) * 100;
    } else {
      const totalOut = Math.max(totalExpenses, 1);
      paymentsPct = (monthlyExpenses / totalOut) * 100;
      subscriptionsPct = (chartProjectedOutflows / totalOut) * 100;
      savingsPct = 0;
    }
  } else {
    if (totalExpenses > 0) {
      paymentsPct = (monthlyExpenses / totalExpenses) * 100;
      subscriptionsPct = (chartProjectedOutflows / totalExpenses) * 100;
      savingsPct = 0;
    } else {
      savingsPct = 100; // Empty state
    }
  }

  const radius = 70;
  const circumference = 2 * Math.PI * radius; // ~439.82

  const chartSegments = [
    {
      name: "Ahorro",
      percentage: savingsPct,
      color: "var(--accent-soft-fg)",
      opacity: 1,
    },
    {
      name: "Pagos",
      percentage: paymentsPct,
      color: "oklch(0.552 0.016 285.938)",
      opacity: 0.8,
    },
    {
      name: "Suscripciones",
      percentage: subscriptionsPct,
      color: "var(--accent-soft-fg)",
      opacity: 0.4,
    },
  ].filter((s) => s.percentage > 0);

  const translateFrequency = (freq: string) => {
    switch (freq) {
      case "daily":
        return "día";
      case "weekly":
        return "sem";
      case "bi-weekly":
        return "quinc";
      case "monthly":
        return "mes";
      case "yearly":
        return "año";
      default:
        return freq;
    }
  };

  const formatIncomeScheduleLabel = (income: any) => {
    if (
      income?.frequency === "bi-weekly" &&
      Array.isArray(income.schedule_days) &&
      income.schedule_days.length >= 2
    ) {
      return `quincenal · días ${income.schedule_days[0]} y ${income.schedule_days[1]}`;
    }

    return income?.frequency
      ? translateFrequency(income.frequency)
      : "recurrente";
  };

  // Compile all transactions into a unified log from payments (which contains the transactions ledger)
  const transactionsLog = (payments || [])
    .map((tx) => {
      let type: "income" | "payment" | "subscription" = "payment";
      let displayDate = tx.category || "Gasto";
      let action = deletePayment.bind(null, tx.id);

      if (tx.amount > 0) {
        type = "income";
        displayDate =
          tx.source_type === "income_recurring"
            ? "Ingreso recurrente"
            : "Ingreso";
      } else if (tx.source_type === "subscription_recurring") {
        type = "subscription";
        displayDate = "Suscripción";
      } else {
        type = "payment";
        displayDate = tx.category || "Servicio";
      }

      const rawTemplate =
        tx.source_type === "subscription_recurring"
          ? (subscriptions || []).find((s) => s.id === tx.source_id)
          : tx.source_type === "income_recurring"
            ? (incomes || []).find((i) => i.id === tx.source_id)
            : null;

      if (tx.source_type === "income_recurring" && rawTemplate) {
        displayDate = formatIncomeScheduleLabel(rawTemplate);
      }

      return {
        id: tx.id,
        title: tx.title,
        type,
        amount: Number(tx.amount), // positive for income, negative for expenses/subscriptions
        date: new Date(tx.date || tx.created_at || Date.now()),
        displayDate,
        status: tx.status,
        action,
        raw: rawTemplate, // for editing/viewing template if needed
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

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
        amount: Math.abs(Number(pay.amount)),
        date: new Date(pay.date || Date.now()),
        type:
          Number(pay.amount) > 0 ? ("income" as const) : ("payment" as const),
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

  const formatDate = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    return d.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const dashboardTourSteps = [
    {
      id: "sidebar",
      target: "sidebarDashboard" as TourTargetKey,
      eyebrow: "01 · navegación",
      title: "Sidebar",
      description: "Aquí navegas entre los módulos principales del sistema.",
      accent: "Usa este menú para moverte rápido entre vistas.",
      preview: ["dashboard", "transacciones", "ajustes"],
    },
    {
      id: "balance",
      target: "balanceCard" as TourTargetKey,
      eyebrow: "02 · resumen",
      title: "Resumen",
      description:
        "Muestra tu saldo disponible y el estado general de tu dinero.",
      accent: `Disponible: ${formatMoney(availableBalance)}.`,
      preview: ["saldo disponible", "ingresos", "egresos"],
    },
    {
      id: "flow",
      target: "transactionsSection" as TourTargetKey,
      eyebrow: "03 · movimiento",
      title: "Movimientos",
      description: "Aquí ves próximos eventos y transacciones recientes.",
      accent: "Te ayuda a revisar actividad y seguimiento del día a día.",
      preview: ["próximos pagos", "historial", "estado de pagos"],
    },
    {
      id: "quick-actions",
      target: "quickMenu" as TourTargetKey,
      eyebrow: "04 · captura rápida",
      title: "Menú rápido",
      description: "Desde aquí registras acciones sin salir del dashboard.",
      accent: "Es la forma más rápida de cargar actividad.",
      preview: ["ingresos", "pagos", "suscripciones"],
    },
  ];

  const handleAction = async (
    actionFn: (fd: FormData) => Promise<void>,
    fd: FormData,
    successMessage: string,
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

  const closeTour = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DASHBOARD_TOUR_STORAGE_KEY, "true");
      if (window.location.search.includes("tour=1")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    setIsTourOpen(false);
  }, []);

  const openTour = React.useCallback(() => {
    setTourStep(0);
    setIsTourOpen(true);
  }, []);

  const currentTourStep = dashboardTourSteps[tourStep];
  const tourProgress = ((tourStep + 1) / dashboardTourSteps.length) * 100;
  const currentTourRect = currentTourStep
    ? tourRects[currentTourStep.target]
    : null;
  const isMobileViewport =
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 1023px)").matches
      : false;

  const floatingCardStyle = React.useMemo(() => {
    if (!currentTourRect || isMobileViewport) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(92vw, 360px)",
      } as React.CSSProperties;
    }

    const cardWidth = 440;
    const spacing = 14;
    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth : 1440;
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : 900;
    const fitsRight =
      currentTourRect.left + currentTourRect.width + spacing + cardWidth <
      viewportWidth - 24;
    const proposedLeft = fitsRight
      ? currentTourRect.left + currentTourRect.width + spacing
      : Math.max(24, currentTourRect.left - cardWidth - spacing);
    const proposedTop = Math.min(
      Math.max(24, currentTourRect.top),
      Math.max(24, viewportHeight - 240),
    );

    return {
      top: proposedTop,
      left: proposedLeft,
      width: cardWidth,
    } as React.CSSProperties;
  }, [currentTourRect, isMobileViewport]);

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col lg:flex-row font-sans">
      {/* 1. LEFT SIDEBAR NAVIGATION (Desktop) */}
      <Sidebar
        activeTab="dashboard"
        profile={profile}
        currency={currency}
        dashboardRef={sidebarDashboardRef}
      />

      {/* 2. MOBILE HEADER & NAVIGATION */}
      <header className="lg:hidden border-b border-premium bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-2">
          <AppLogo size="sm" variant="full" priority />
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
            <AppLogo size="sm" variant="full" />
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => setIsMobileMenuOpen(false)}
            >
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
              <span className="font-mono uppercase tracking-wider text-xs">
                dashboard
              </span>
            </Link>

            <Link
              href="/dashboard/transactions"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground hover:bg-muted/10 transition-all duration-200"
            >
              <IconReceipt className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">
                transacciones
              </span>
            </Link>

            <Link
              href="/dashboard/subscriptions"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground hover:bg-muted/10 transition-all duration-200"
            >
              <IconCreditCard className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">
                suscripciones
              </span>
            </Link>

            <div className="flex items-center justify-between px-4 py-3 rounded-xl text-muted-foreground opacity-60">
              <span className="flex items-center space-x-3">
                <IconChartBar className="size-4" />
                <span className="font-mono uppercase tracking-wider text-xs">
                  proyecciones (pro)
                </span>
              </span>
              <IconLock className="size-3" />
            </div>

            <Link
              href="/dashboard/settings"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-sm text-muted-foreground hover:bg-muted/10 transition-all duration-200"
            >
              <IconSettings className="size-4" />
              <span className="font-mono uppercase tracking-wider text-xs">
                ajustes
              </span>
            </Link>
          </nav>

          <div className="border-t border-premium pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono font-bold">
                {profile.full_name.toLowerCase()}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">
                divisa: {currency}
              </p>
            </div>
            <form action={signout}>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 uppercase font-mono text-[10px]"
              >
                <IconLogout className="size-3.5" /> salir
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <main
        ref={mainScrollRef}
        className="flex-1 min-w-0 overflow-y-auto bg-background"
      >
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
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold">
                  /resumen_financiero
                </span>
                <h1 className="font-heading-style text-3xl font-black tracking-tight text-accent-soft-fg lowercase">
                  hola, {profile.full_name.split(" ")[0]}!
                </h1>
                {profile.tagline && (
                  <p className="text-[10px] text-muted-foreground font-mono italic">
                    “{profile.tagline}”
                  </p>
                )}
              </div>

            </div>

            {/* Primary Net Balance Card */}
            <Card ref={balanceCardRef} soft className="overflow-hidden">
              <CardContent className="pt-0 space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <span className="inline-flex rounded-full border border-accent-soft-border bg-background/55 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-accent-soft-fg">
                      saldo disponible
                    </span>
                    <p className="text-4xl md:text-5xl font-mono font-black tracking-[-0.06em] text-foreground">
                      {formatMoney(availableBalance)}
                    </p>
                    <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                      <span className="rounded-full border border-accent-soft-border/70 bg-background/50 px-2.5 py-1 text-accent-soft-fg">
                        presupuestable {formatMoney(availableToBudget)}
                      </span>
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-amber-700 dark:text-amber-400">
                        tras deuda {formatMoney(availableAfterDebtMinimums)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
                    <div className="rounded-2xl border border-accent-soft-border/40 bg-background/55 px-4 py-3">
                      <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                        patrimonio
                      </p>
                      <p className="mt-1 text-sm font-mono font-bold text-foreground">
                        {formatMoney(netWorth)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-accent-soft-border/40 bg-background/55 px-4 py-3">
                      <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                        deuda viva
                      </p>
                      <p className="mt-1 text-sm font-mono font-bold text-foreground">
                        {formatMoney(totalDebtOutstanding)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-emerald-500/20 bg-background/55 px-4 py-3 space-y-1">
                    <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                      ingresos del mes
                    </p>
                    <p className="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(monthlyIncome)}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {incomes?.length || 0} reglas activas
                    </p>
                  </div>

                  <div className="rounded-2xl border border-destructive/15 bg-background/55 px-4 py-3 space-y-1">
                    <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                      egresos del mes
                    </p>
                    <p className="text-xl font-mono font-bold text-destructive">
                      -{formatMoney(monthlyExpenses)}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {subscriptions?.length || 0} reglas activas
                    </p>
                  </div>

                  <div className="rounded-2xl border border-accent-soft-border/40 bg-background/55 px-4 py-3 space-y-1">
                    <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                      flujo 30 días
                    </p>
                    <p
                      className={`text-xl font-mono font-bold ${projectedCashflow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
                    >
                      {projectedCashflow >= 0 ? "+" : "-"}
                      {formatMoney(Math.abs(projectedCashflow))}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      cuotas deuda: {formatMoney(debtMinimums)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Payments (Horizontal Row like the mockup) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-heading-style text-lg font-bold tracking-tight text-foreground lowercase">
                  /próximos 30 días
                </h2>
                <Link
                  href="/dashboard/agenda"
                  className="text-[10px] font-mono text-muted-foreground uppercase hover:text-foreground transition-colors"
                >
                  ver agenda de pagos
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {upcomingEvents.length === 0 ? (
                  <Card className="flex flex-col justify-center items-center text-center p-8 bg-background border border-dashed border-border min-h-[140px] col-span-2 rounded-2xl">
                    <p className="font-mono text-xs text-muted-foreground uppercase font-bold">
                      [!] no hay pagos pendientes
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      Todo al día. Registra tus ingresos, pagos o suscripciones
                      desde el menú rápido.
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
                          <div
                            className={`size-10 rounded-full flex items-center justify-center font-bold text-sm font-mono uppercase ${
                              isFirst
                                ? "bg-background border border-accent-soft-border/30 text-accent-soft-fg"
                                : "bg-muted/20 border border-border text-muted-foreground"
                            }`}
                          >
                            {initials}
                          </div>
                          <span
                            className={`text-[9px] font-mono font-bold px-2 py-0.5 border rounded-full uppercase ${
                              isFirst
                                ? "border-accent-soft-border/30 bg-background/50 text-accent-soft-fg"
                                : "border-border bg-muted/10 text-muted-foreground"
                            }`}
                          >
                            {event.type === "subscription"
                              ? "recurrente"
                              : event.type === "income"
                                ? "ingreso"
                                : "pendiente"}
                          </span>
                        </div>
                        <div className="mt-4">
                          <p className="font-heading-style text-base font-bold text-foreground truncate">
                            {event.name}
                          </p>
                          <div className="flex justify-between items-end mt-1">
                            <p className="text-xs font-mono text-muted-foreground">
                              <span className="font-bold text-foreground">
                                {formatMoney(event.amount)}
                              </span>
                              {(event.type === "subscription" ||
                                event.type === "income") &&
                                `/${event.displayFreq}`}
                            </p>
                            <p
                              className={`text-[10px] font-mono font-bold ${
                                isFirst
                                  ? "text-accent-soft-fg animate-pulse"
                                  : "text-muted-foreground"
                              }`}
                            >
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
            <div ref={transactionsSectionRef} className="space-y-4">
              <h2 className="font-heading-style text-lg font-bold tracking-tight text-foreground lowercase">
                /transacciones recientes
              </h2>

              <Card className="bg-background shadow-premium p-0 overflow-hidden">
                <div className="divide-y divide-border/60">
                  {transactionsLog.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground font-mono text-xs">
                      No hay transacciones registradas. Registra un ingreso o un
                      pago para comenzar.
                    </div>
                  ) : (
                    transactionsLog.slice(0, 10).map((tx) => (
                      <div
                        key={tx.id}
                        className={`flex items-center justify-between p-4 hover:bg-muted/5 transition-colors ${
                          tx.type === "payment" && tx.status === "paid"
                            ? "opacity-60"
                            : ""
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div
                            className={`size-8 rounded-full flex items-center justify-center font-bold text-xs font-mono uppercase ${
                              tx.type === "income"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                : tx.type === "subscription"
                                  ? "bg-accent-soft-bg text-accent-soft-fg border border-accent-soft-border/30"
                                  : "bg-muted/20 text-muted-foreground border border-border"
                            }`}
                          >
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
                          <span
                            className={`text-xs font-mono font-bold ${
                              tx.type === "income"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-destructive"
                            }`}
                          >
                            {tx.type === "income" ? "+" : "-"}
                            {formatMoney(Math.abs(tx.amount))}
                          </span>

                          {(tx.type === "payment" ||
                            tx.type === "subscription") && (
                            <button
                              type="button"
                              onClick={() => {
                                setStatusPendingId(tx.id);
                                startTransition(async () => {
                                  try {
                                    await togglePaymentStatus(
                                      tx.id,
                                      tx.status || "unpaid",
                                    );
                                    sileo.success({
                                      title: `Pago marcado como ${
                                        tx.status === "paid"
                                          ? "pendiente"
                                          : "pagado"
                                      }`,
                                    });
                                  } catch (err: any) {
                                    if (
                                      err &&
                                      err.digest &&
                                      err.digest.startsWith("NEXT_REDIRECT")
                                    ) {
                                      throw err;
                                    }
                                    sileo.error({
                                      title:
                                        err.message ||
                                        "Error al actualizar estado",
                                    });
                                  } finally {
                                    setStatusPendingId(null);
                                  }
                                });
                              }}
                              className={`text-[9px] font-mono px-2 py-0.5 border cursor-pointer ${
                                tx.status === "paid"
                                  ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5 font-bold"
                                  : "border-border text-muted-foreground"
                              } rounded-md hover:opacity-80 transition-opacity`}
                              disabled={isPending || statusPendingId === tx.id}
                            >
                              {statusPendingId === tx.id ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <IconLoader2 className="size-3 animate-spin" />
                                  actualizando
                                </span>
                              ) : tx.status === "paid" ? (
                                "PAGADO"
                              ) : (
                                "PENDIENTE"
                              )}
                            </button>
                          )}

                          {tx.type === "subscription" && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSubscription(tx.raw);
                                setIsExpenseRecurring(true);
                                setActiveModal("payment");
                              }}
                              className="text-muted-foreground hover:text-accent-soft-fg p-1 transition-colors"
                              aria-label="Editar"
                            >
                              <IconPencil className="size-3.5" />
                            </button>
                          )}

                          {tx.type === "income" && tx.raw && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingIncome(tx.raw);
                                setIsIncomeRecurring(true);
                                setActiveModal("income");
                              }}
                              className="text-muted-foreground hover:text-accent-soft-fg p-1 transition-colors"
                              aria-label="Editar"
                            >
                              <IconPencil className="size-3.5" />
                            </button>
                          )}

                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </section>

          {/* COLUMN 2: DONUT CHART, QUICK MENU (xl:col-span-4) */}
          <section className="xl:col-span-4 space-y-8">
            {/* SVG Donut Chart Activity Card */}
            <Card className="bg-background shadow-premium">
              <CardContent className="pt-0 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-heading-style font-bold text-sm lowercase">
                    /actividad
                  </h3>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold">
                    mensual
                  </span>
                </div>

                <div className="relative size-56 mx-auto flex items-center justify-center">
                  <svg
                    width="220"
                    height="220"
                    viewBox="0 0 200 200"
                    className="transform -rotate-90"
                  >
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
                    <span className="text-lg font-bold font-mono tracking-tighter">
                      {formatCompactMoney(availableAfterDebtMinimums)}
                    </span>
                    <span className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider mt-1">
                      caja tras deuda
                    </span>
                  </div>
                </div>

                {/* Donut Legend */}
                <div className="grid grid-cols-3 gap-2 border-t border-dashed border-border pt-4 text-center font-mono text-[10px]">
                  <div className="space-y-1">
                    <span className="inline-block size-2 rounded-full bg-accent-soft-fg" />
                    <p className="text-muted-foreground">Presup.</p>
                    <p className="font-bold text-foreground">
                      {savingsPct.toFixed(0)}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="inline-block size-2 rounded-full bg-muted-foreground" />
                    <p className="text-muted-foreground">Mes</p>
                    <p className="font-bold text-foreground">
                      {paymentsPct.toFixed(0)}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="inline-block size-2 rounded-full bg-accent-soft-fg opacity-40" />
                    <p className="text-muted-foreground">Próx.30d</p>
                    <p className="font-bold text-foreground">
                      {subscriptionsPct.toFixed(0)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Menu Actions */}
            <div ref={quickMenuRef} className="space-y-3">
              <h3 className="font-heading-style text-sm font-bold text-foreground lowercase">
                /menú rápido
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setEditingIncome(null);
                    setActiveModal("income");
                  }}
                  className="flex flex-col items-center justify-center p-4 border border-premium bg-card hover:bg-accent-soft-bg hover:border-accent-soft-border text-muted-foreground hover:text-accent-soft-fg rounded-2xl transition-all duration-200 group text-center cursor-pointer"
                >
                  <IconCoin className="size-5 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider">
                    ingreso
                  </span>
                </button>

                <button
                  onClick={() => {
                    setEditingSubscription(null);
                    setIsExpenseRecurring(false);
                    setActiveModal("payment");
                  }}
                  className="flex flex-col items-center justify-center p-4 border border-premium bg-card hover:bg-accent-soft-bg hover:border-accent-soft-border text-muted-foreground hover:text-accent-soft-fg rounded-2xl transition-all duration-200 group text-center cursor-pointer"
                >
                  <IconCreditCard className="size-5 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider">
                    pago
                  </span>
                </button>

                <button
                  onClick={() => {
                    if (isPro) {
                      setEditingSubscription(null);
                      setIsExpenseRecurring(true);
                      setActiveModal("payment");
                    } else {
                      // Pro Upgrade simulation trigger
                      window.location.href =
                        "/api/checkout/stripe?simulated=true";
                    }
                  }}
                  className="flex flex-col items-center justify-center p-4 border border-premium bg-card hover:bg-accent-soft-bg hover:border-accent-soft-border text-muted-foreground hover:text-accent-soft-fg rounded-2xl transition-all duration-200 group relative text-center cursor-pointer"
                >
                  {!isPro && (
                    <IconLock className="size-3 text-muted-foreground/60 absolute top-2 right-2" />
                  )}
                  <IconSparkles className="size-5 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider">
                    suscrip.
                  </span>
                </button>
              </div>
            </div>

            {/* Smart saving recommendations or locked projections */}
            <Card className="bg-background shadow-premium border border-dashed border-border p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <IconSparkles className="size-4 text-accent-soft-fg animate-pulse" />
                  <h3 className="font-heading-style font-bold text-xs lowercase">
                    /proyección inteligente
                  </h3>
                </div>

                {isPro ? (
                  <div className="space-y-3 font-mono text-[10px] leading-relaxed">
                    <p className="text-muted-foreground">
                      Tu operación financiera proyectada con la caja y el flujo
                      actual:
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2 border border-premium rounded-xl bg-card">
                        <span className="text-muted-foreground block uppercase text-[8px]">
                          Flujo 90 días
                        </span>
                        <span className="font-bold text-foreground">
                          {formatMoney(projectedCashflow * 3)}
                        </span>
                      </div>
                      <div className="p-2 border border-premium rounded-xl bg-card">
                        <span className="text-muted-foreground block uppercase text-[8px]">
                          Runway aprox.
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {runwayDays ? `${runwayDays} días` : "estable"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-center">
                    <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                      Proyecciones de balance futuro y alertas inteligentes
                      bloqueadas.
                    </p>
                    <Link href="/api/checkout/stripe?simulated=true">
                      <Button
                        variant="soft"
                        size="xs"
                        className="text-[9px] tracking-wider uppercase font-mono w-full justify-center"
                      >
                        actualizar a pro ($9/mes)
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </Card>

          </section>
        </div>
      </main>

      {/* 4. MODALS OVERLAYS FOR ADDING DATA */}
      {activeModal && (
        <AnimatedModal
          open={!!activeModal}
          overlayClassName="flex items-center justify-center bg-background/80 backdrop-blur-md px-4"
          panelClassName="max-w-md w-full"
        >
          <Card className="max-w-md w-full bg-card border border-premium shadow-premium-lg relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-heading-style text-lg font-bold tracking-tight text-foreground lowercase">
                /
                {activeModal === "income"
                  ? editingIncome
                    ? "editar_ingreso"
                    : "registrar_ingreso"
                  : activeModal === "payment"
                    ? "registrar_pago"
                    : editingSubscription
                      ? "editar_suscripcion"
                      : "registrar_suscripcion"}
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
                key={editingIncome ? `edit-${editingIncome.id}` : "new"}
                action={(fd) =>
                  handleAction(
                    editingIncome ? editIncome : addIncome,
                    fd,
                    editingIncome
                      ? "Ingreso actualizado con éxito"
                      : "Ingreso registrado con éxito",
                  )
                }
                className="space-y-4 font-mono text-xs"
              >
                {editingIncome && (
                  <input type="hidden" name="id" value={editingIncome.id} />
                )}
                <div className="space-y-1">
                  <Label
                    htmlFor="modal-source"
                    className="text-[10px] font-bold uppercase"
                  >
                    Fuente de Ingreso
                  </Label>
                  <Input
                    id="modal-source"
                    name="source"
                    placeholder="Nómina Mensual"
                    defaultValue={editingIncome?.source || ""}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="modal-income-amount"
                    className="text-[10px] font-bold uppercase"
                  >
                    Monto ({currency})
                  </Label>
                  <Input
                    id="modal-income-amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    placeholder="2500"
                    defaultValue={editingIncome?.amount || ""}
                    required
                  />
                </div>

                {/* Toggle Recurrente */}
                <div className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded-xl">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase block">
                      ¿Es recurrente?
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {isIncomeRecurring
                        ? "Se recibe periódicamente"
                        : "Ingreso de una sola vez"}
                    </span>
                  </div>
                  <Switch
                    checked={isIncomeRecurring}
                    onCheckedChange={setIsIncomeRecurring}
                    aria-label="Alternar ingreso recurrente"
                  />
                  <input
                    type="hidden"
                    name="is_recurring"
                    value={isIncomeRecurring ? "true" : "false"}
                  />
                </div>

                {isIncomeRecurring ? (
                  <IncomeRecurringFields
                    frequency={
                      incomeFrequency as "weekly" | "bi-weekly" | "monthly"
                    }
                    onFrequencyChange={setIncomeFrequency}
                    primaryDay={incomeDay}
                    onPrimaryDayChange={setIncomeDay}
                    secondaryDay={incomeSecondaryDay}
                    onSecondaryDayChange={setIncomeSecondaryDay}
                    frequencyId="modal-income-freq"
                    primaryDayId="modal-income-day"
                    secondaryDayId="modal-income-day-two"
                  />
                ) : (
                  <div className="space-y-1">
                    <Label
                      htmlFor="modal-income-date"
                      className="text-[10px] font-bold uppercase"
                    >
                      Fecha de Ingreso
                    </Label>
                    <Input
                      id="modal-income-date"
                      name="next_pay_date"
                      type="date"
                      defaultValue={todayLocalIso()}
                      required
                    />
                  </div>
                )}

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
                    ) : editingIncome ? (
                      <IconPencil className="size-3.5" />
                    ) : (
                      <IconPlus className="size-3.5" />
                    )}
                    {editingIncome ? "guardar" : "agregar"}
                  </Button>
                </div>
              </form>
            )}

            {activeModal === "payment" && (
              <form
                key={
                  editingSubscription ? `edit-${editingSubscription.id}` : "new"
                }
                action={(fd) =>
                  handleAction(
                    editingSubscription ? editSubscription : addPayment,
                    fd,
                    editingSubscription
                      ? "Gasto actualizado con éxito"
                      : "Gasto registrado con éxito",
                  )
                }
                className="space-y-4 font-mono text-xs"
              >
                {editingSubscription && (
                  <input
                    type="hidden"
                    name="id"
                    value={editingSubscription.id}
                  />
                )}
                <div className="space-y-1">
                  <Label
                    htmlFor="modal-title"
                    className="text-[10px] font-bold uppercase"
                  >
                    Concepto del Gasto
                  </Label>
                  <Input
                    id="modal-title"
                    name={editingSubscription ? "name" : "title"}
                    placeholder="Internet Fibra"
                    defaultValue={editingSubscription?.name || ""}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="modal-pay-amount"
                    className="text-[10px] font-bold uppercase"
                  >
                    Monto ({currency})
                  </Label>
                  <Input
                    id="modal-pay-amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    placeholder="45"
                    defaultValue={editingSubscription?.amount || ""}
                    required
                  />
                </div>

                {editingSubscription || isExpenseRecurring ? (
                  <CategoryLibraryInput
                    id="dashboard-subscription-category"
                    name="category"
                    label="Categoría"
                    value={subscriptionCategoryValue}
                    onChange={setSubscriptionCategoryValue}
                    categories={expenseCategoryLibrary}
                    placeholder="servicios"
                    helperText="Elige una categoría sugerida o escribe una nueva para guardarla."
                  />
                ) : (
                  <div className="space-y-1">
                    <Label
                      htmlFor="dashboard-payment-category"
                      className="text-[10px] font-bold uppercase"
                    >
                      Categoría
                    </Label>
                    <Input
                      id="dashboard-payment-category"
                      name="category"
                      placeholder="servicios"
                      value={subscriptionCategoryValue}
                      onChange={(event) =>
                        setSubscriptionCategoryValue(event.target.value)
                      }
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded-xl">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase block">
                      ¿Es recurrente? (Suscripción)
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {isExpenseRecurring
                        ? "Se debita periódicamente"
                        : "Pago de una sola vez"}
                    </span>
                  </div>
                  <Switch
                    checked={isExpenseRecurring}
                    onCheckedChange={(checked) => {
                      if (isPro) {
                        setIsExpenseRecurring(checked);
                      } else {
                        window.location.href =
                          "/api/checkout/stripe?simulated=true";
                      }
                    }}
                    aria-label="Alternar gasto recurrente"
                  />
                  <input
                    type="hidden"
                    name="is_recurring"
                    value={isExpenseRecurring ? "true" : "false"}
                  />
                </div>

                {isExpenseRecurring ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label
                          htmlFor="modal-sub-freq"
                          className="text-[10px] font-bold uppercase"
                        >
                          Frecuencia de Cobro
                        </Label>
                        <SubscriptionFrequencySelect
                          id="modal-sub-freq"
                          name="billing_cycle"
                          value={expenseFrequency}
                          onChange={(e) => setExpenseFrequency(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="modal-sub-day"
                          className="text-[10px] font-bold uppercase"
                        >
                          Día del Mes
                        </Label>
                        <Input
                          id="modal-sub-day"
                          name="day_of_month"
                          type="number"
                          min="1"
                          max={expenseFrequency === "bi-weekly" ? "15" : "31"}
                          placeholder="5"
                          value={expenseDay}
                          onChange={(e) => {
                            const val = e.target.value;
                            const parsed = parseInt(val);
                            const maxVal =
                              expenseFrequency === "bi-weekly" ? 15 : 31;
                            if (val === "") {
                              setExpenseDay("");
                            } else if (!isNaN(parsed)) {
                              setExpenseDay(
                                String(Math.max(1, Math.min(maxVal, parsed))),
                              );
                            }
                          }}
                          required
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-accent-soft-fg font-mono mt-1 leading-relaxed">
                      {expenseFrequency === "bi-weekly"
                        ? `Los pagos se realizarán los días ${parseInt(expenseDay) || 1} y ${(parseInt(expenseDay) || 1) + 15} de cada mes.`
                        : "El pago recurrente se materializará automáticamente con la frecuencia elegida."}
                    </p>
                  </>
                ) : (
                  <div className="space-y-1">
                    <Label
                      htmlFor="modal-pay-date"
                      className="text-[10px] font-bold uppercase"
                    >
                      Fecha de Gasto
                    </Label>
                    <Input
                      id="modal-pay-date"
                      name="next_pay_date"
                      type="date"
                      defaultValue={todayLocalIso()}
                      required
                    />
                  </div>
                )}

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
        </AnimatedModal>
      )}

      {isTourOpen && currentTourStep && (
        <div className="fixed inset-0 z-[60] animate-fade-in pointer-events-none">
          <div className="absolute inset-0 bg-background/72 backdrop-blur-[2px]" />

          {currentTourRect && (
            <>
              <div
                className="absolute rounded-[28px] border-2 border-accent-soft-border shadow-[0_0_0_9999px_rgba(0,0,0,0.38)] transition-all duration-300"
                style={{
                  top: currentTourRect.top - 8,
                  left: currentTourRect.left - 8,
                  width: currentTourRect.width + 16,
                  height: currentTourRect.height + 16,
                }}
              />
              {!isMobileViewport && (
                <div
                  className="absolute h-px bg-accent-soft-fg/80"
                  style={{
                    top:
                      currentTourRect.top +
                      Math.min(currentTourRect.height / 2, 56),
                    left:
                      currentTourRect.left + currentTourRect.width + 8 <
                      (typeof window !== "undefined" ? window.innerWidth : 0) /
                        2
                        ? currentTourRect.left + currentTourRect.width + 8
                        : Math.max(24, currentTourRect.left - 48),
                    width: 48,
                  }}
                />
              )}
            </>
          )}

          <Card
            className="absolute pointer-events-auto bg-card border border-premium shadow-premium-lg animate-scale-up"
            style={floatingCardStyle}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-accent-soft-fg">
                    pilot de bienvenida
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    {tourStep + 1}/{dashboardTourSteps.length}
                  </span>
                </div>
                <h3 className="font-heading-style text-base font-black lowercase leading-tight">
                  {currentTourStep.title}
                </h3>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={closeTour}
                aria-label="Cerrar recorrido"
              >
                <IconX className="size-3.5" />
              </Button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-soft-fg transition-all duration-300"
                  style={{ width: `${tourProgress}%` }}
                />
              </div>

              <div
                className={`gap-3 ${isMobileViewport ? "space-y-3" : "grid grid-cols-[1.1fr_0.9fr] items-start"}`}
              >
                <div className="space-y-2 min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-accent-soft-fg">
                    {currentTourStep.eyebrow}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {currentTourStep.description}
                  </p>
                  <div className="rounded-xl border border-accent-soft-border bg-accent-soft-bg/70 p-3">
                    <p className="text-[11px] text-accent-soft-fg leading-relaxed">
                      {currentTourStep.accent}
                    </p>
                  </div>
                </div>

                <div
                  className={`min-w-0 ${isMobileViewport ? "space-y-1.5" : "grid grid-cols-1 gap-1.5"}`}
                >
                  {currentTourStep.preview.map((item) => (
                    <div
                      key={item}
                      className="rounded-lg border border-premium bg-background px-2.5 py-2 text-[10px] text-foreground leading-snug"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setTourStep((prev) => Math.max(prev - 1, 0))}
                    disabled={tourStep === 0}
                    aria-label="Paso anterior"
                  >
                    <IconArrowLeft className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-[9px]"
                    onClick={closeTour}
                  >
                    saltar
                  </Button>
                </div>

                {tourStep === dashboardTourSteps.length - 1 ? (
                  <Button type="button" size="sm" onClick={closeTour}>
                    terminar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon-sm"
                    onClick={() =>
                      setTourStep((prev) =>
                        Math.min(prev + 1, dashboardTourSteps.length - 1),
                      )
                    }
                    aria-label="Siguiente paso"
                  >
                    <IconArrowRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {deleteTarget && (
        <AnimatedModal
          open={!!deleteTarget}
          overlayClassName="flex items-center justify-center bg-background/80 backdrop-blur-md px-4"
          panelClassName="max-w-sm w-full"
        >
          <Card className="max-w-sm w-full bg-card border border-premium shadow-premium-lg relative">
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
                ¿Estás seguro de que deseas eliminar permanentemente el/la{" "}
                {deleteTarget.type === "income"
                  ? "ingreso"
                  : deleteTarget.type === "payment"
                    ? "pago"
                    : "suscripción"}
                :{" "}
                <span className="text-foreground font-bold font-mono">
                  "{deleteTarget.title}"
                </span>
                ? Esta acción no se puede deshacer.
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
                        sileo.success({
                          title: "Registro eliminado con éxito",
                        });
                        setDeleteTarget(null);
                      } catch (err: any) {
                        if (
                          err &&
                          err.digest &&
                          err.digest.startsWith("NEXT_REDIRECT")
                        ) {
                          throw err;
                        }
                        sileo.error({
                          title: err.message || "Error al eliminar",
                        });
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
        </AnimatedModal>
      )}
    </div>
  );
}

// Donut Segment Helper to compute offsets properly
function renderedSegments(
  segments: { percentage: number; color: string; opacity: number }[],
  radius: number,
  circumference: number,
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
