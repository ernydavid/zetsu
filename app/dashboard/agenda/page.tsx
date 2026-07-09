import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/common/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFinanceSnapshot } from "@/lib/finance/service";
import { collectRecurringOccurrencesInRange } from "@/lib/finance/recurring";
import { monthEndIso, monthStartIso, parseIsoDate } from "@/lib/finance/dates";
import { getDebtMonthlyCommitment } from "@/lib/finance/debt-utils";
import {
  IconArrowLeft,
  IconCalendarMonth,
  IconCoin,
  IconCreditCard,
  IconReceipt,
} from "@tabler/icons-react";

type AgendaEvent = {
  id: string;
  date: string;
  title: string;
  amount: number;
  kind: "income" | "expense";
  source: "recorded" | "projected";
  category?: string | null;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatMonthLabel(dateIso: string) {
  return parseIsoDate(dateIso).toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getCalendarDays(monthStart: string, monthEnd: string) {
  const start = parseIsoDate(monthStart);
  const end = parseIsoDate(monthEnd);
  const firstWeekday = (start.getUTCDay() + 6) % 7;
  const daysInMonth = end.getUTCDate();
  const cells: Array<{ iso: string | null; dayNumber: number | null }> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ iso: null, dayNumber: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${monthStart.slice(0, 8)}${String(day).padStart(2, "0")}`;
    cells.push({ iso, dayNumber: day });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ iso: null, dayNumber: null });
  }

  return cells;
}

export default async function AgendaPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const snapshot = await getFinanceSnapshot(supabase, user.id);

  if (!snapshot.profile || !snapshot.profile.full_name || !snapshot.profile.base_currency) {
    redirect("/onboarding");
  }
  const profile = snapshot.profile;

  const monthStart = monthStartIso();
  const monthEnd = monthEndIso();
  const categoryMap = new Map(snapshot.categories.map((category) => [category.id, category.name]));

  const baseTransactions = snapshot.transactions
    .filter((tx) => tx.kind === "income" || tx.kind === "expense")
    .filter((tx) => tx.transaction_date >= monthStart && tx.transaction_date <= monthEnd)
    .map<AgendaEvent>((tx) => ({
      id: tx.id,
      date: tx.transaction_date,
      title: tx.title,
      amount: Number(tx.amount),
      kind: tx.kind === "income" ? "income" : "expense",
      source: "recorded",
      category: tx.category_id ? categoryMap.get(tx.category_id) ?? null : null,
    }));

  const existingRecurringKeys = new Set(
    snapshot.transactions
      .filter((tx) => !!tx.recurring_rule_id)
      .filter((tx) => tx.transaction_date >= monthStart && tx.transaction_date <= monthEnd)
      .map((tx) => `${tx.recurring_rule_id}:${tx.transaction_date}`),
  );

  const projectedRecurringEvents = snapshot.recurringRules
    .filter((rule) => rule.active && !rule.archived_at)
    .flatMap((rule) =>
      collectRecurringOccurrencesInRange(rule, monthStart, monthEnd)
        .filter((date) => !existingRecurringKeys.has(`${rule.id}:${date}`))
        .map<AgendaEvent>((date) => ({
          id: `${rule.id}:${date}`,
          date,
          title: rule.name,
          amount: Number(rule.amount),
          kind: rule.kind === "income" ? "income" : "expense",
          source: "projected",
          category: rule.category_id ? categoryMap.get(rule.category_id) ?? null : null,
        })),
    );

  const monthDayLimit = parseIsoDate(monthEnd).getUTCDate();
  const debtReferenceEvents = snapshot.debtObligations
    .filter((debt) => debt.status === "active" || debt.status === "paused")
    .map<AgendaEvent | null>((debt) => {
      const amount = getDebtMonthlyCommitment(debt);
      if (amount <= 0) {
        return null;
      }

      const day = Math.min(Math.max(Number(debt.due_day ?? 1), 1), monthDayLimit);
      return {
        id: `debt:${debt.id}:${monthStart}:${day}`,
        date: `${monthStart.slice(0, 8)}${String(day).padStart(2, "0")}`,
        title: debt.name,
        amount,
        kind: "expense",
        source: "projected",
        category: "deuda",
      };
    })
    .filter((event): event is AgendaEvent => !!event);

  const agendaEvents = [...baseTransactions, ...projectedRecurringEvents, ...debtReferenceEvents].sort((a, b) => {
    if (a.date === b.date) {
      if (a.kind === b.kind) {
        return a.title.localeCompare(b.title);
      }
      return a.kind === "income" ? -1 : 1;
    }
    return a.date.localeCompare(b.date);
  });

  const eventsByDate = agendaEvents.reduce<Record<string, AgendaEvent[]>>((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {});

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const calendarCells = getCalendarDays(monthStart, monthEnd);
  const weekdayLabels = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex">
      <Sidebar activeTab="dashboard" profile={profile} currency={profile.base_currency} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 lg:py-12 space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold">
                /agenda_de_movimientos
              </span>
              <h1 className="font-heading-style text-3xl font-black tracking-tight text-accent-soft-fg lowercase">
                agenda del mes
              </h1>
              <p className="text-xs text-muted-foreground font-mono max-w-2xl">
                Calendario del mes actual con ingresos, pagos, suscripciones y vencimientos de deuda registrados o proyectados.
              </p>
            </div>

            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <IconArrowLeft className="size-4" />
                volver al dashboard
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border border-premium">
              <CardContent className="pt-0 space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">mes visible</span>
                <p className="text-2xl font-mono font-bold capitalize">{formatMonthLabel(monthStart)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border border-premium">
              <CardContent className="pt-0 space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">movimientos del mes</span>
                <p className="text-2xl font-mono font-bold">{agendaEvents.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border border-premium">
              <CardContent className="pt-0 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl border border-accent-soft-border bg-accent-soft-bg text-accent-soft-fg">
                  <IconCalendarMonth className="size-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">lectura</span>
                  <p className="text-xs font-mono text-foreground">Los chips grises claros son movimientos proyectados.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border border-premium overflow-hidden">
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-7 gap-2">
                {weekdayLabels.map((label) => (
                  <div
                    key={label}
                    className="rounded-xl border border-premium bg-muted/10 px-3 py-2 text-center text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}

                {calendarCells.map((cell, index) => {
                  if (!cell.iso || !cell.dayNumber) {
                    return <div key={`empty-${index}`} className="min-h-[148px] rounded-2xl border border-dashed border-border/70 bg-transparent" />;
                  }

                  const dayEvents = eventsByDate[cell.iso] ?? [];
                  const extraCount = dayEvents.length > 3 ? dayEvents.length - 3 : 0;
                  const isToday = cell.iso === todayIso;

                  return (
                    <div
                      key={cell.iso}
                      className={`min-h-[148px] rounded-2xl border p-3 transition-colors ${
                        isToday
                          ? "border-accent-soft-border bg-accent-soft-bg/40"
                          : "border-premium bg-background/80"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className={`text-sm font-mono font-bold ${isToday ? "text-accent-soft-fg" : "text-foreground"}`}>
                          {String(cell.dayNumber).padStart(2, "0")}
                        </span>
                        {isToday ? (
                          <span className="rounded-full border border-accent-soft-border bg-background/70 px-2 py-0.5 text-[9px] font-mono uppercase text-accent-soft-fg">
                            hoy
                          </span>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        {dayEvents.length === 0 ? (
                          <p className="text-[10px] font-mono text-muted-foreground">sin movimientos</p>
                        ) : (
                          dayEvents.slice(0, 3).map((event) => {
                            const isSubscription =
                              event.kind === "expense" &&
                              (event.category?.toLowerCase() === "suscripción" ||
                                event.category?.toLowerCase() === "suscripcion");
                            const isDebt = event.kind === "expense" && event.category?.toLowerCase() === "deuda";

                            return (
                              <div
                                key={event.id}
                                className={`rounded-xl border px-2.5 py-2 text-[10px] font-mono ${
                                  event.kind === "income"
                                    ? event.source === "projected"
                                      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : isSubscription
                                      ? event.source === "projected"
                                        ? "border-accent-soft-border/60 bg-accent-soft-bg/45 text-accent-soft-fg"
                                        : "border-accent-soft-border bg-accent-soft-bg text-accent-soft-fg"
                                      : isDebt
                                        ? event.source === "projected"
                                          ? "border-sky-500/20 bg-sky-500/8 text-sky-700 dark:text-sky-300"
                                          : "border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-200"
                                      : event.source === "projected"
                                        ? "border-border bg-muted/10 text-muted-foreground"
                                        : "border-destructive/20 bg-destructive/5 text-destructive"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate font-bold">{event.title}</p>
                                    <p className="mt-0.5 truncate uppercase tracking-[0.14em] opacity-80">
                                      {event.kind === "income" ? "ingreso" : isDebt ? "cuota deuda" : event.category || "pago"}
                                    </p>
                                  </div>
                                  {event.kind === "income" ? (
                                    <IconCoin className="size-3.5 shrink-0" />
                                  ) : isSubscription || isDebt ? (
                                    <IconCreditCard className="size-3.5 shrink-0" />
                                  ) : (
                                    <IconReceipt className="size-3.5 shrink-0" />
                                  )}
                                </div>
                                <p className="mt-2 font-bold">
                                  {event.kind === "income" ? "+" : "-"}
                                  {formatMoney(Math.abs(event.amount), profile.base_currency)}
                                </p>
                              </div>
                            );
                          })
                        )}

                        {extraCount > 0 ? (
                          <p className="text-[10px] font-mono text-muted-foreground">
                            +{extraCount} movimiento{extraCount === 1 ? "" : "s"} más
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
