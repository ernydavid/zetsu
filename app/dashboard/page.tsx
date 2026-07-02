import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardClient } from "@/app/dashboard/dashboard-client";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function getNextDate(currentDateStr: string, cycle: string): string {
  const [year, month, day] = currentDateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));

  switch (cycle) {
    case "daily":
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "bi-weekly": {
      const maxDaysInCurrentMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (day <= 15) {
        const targetDay = Math.min(day + 15, maxDaysInCurrentMonth);
        d.setUTCDate(targetDay);
      } else {
        const baseDay = (day === maxDaysInCurrentMonth) ? 15 : (day - 15);
        d.setUTCMonth(d.getUTCMonth() + 1);
        const nextYear = d.getUTCFullYear();
        const nextMonth = d.getUTCMonth();
        const maxDaysInNextMonth = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
        d.setUTCDate(Math.min(baseDay, maxDaysInNextMonth));
      }
      break;
    }
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    case "one-time":
      return "9999-12-31";
    default:
      return "9999-12-31";
  }
  return d.toISOString().split("T")[0];
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorMsg = typeof params.error === "string" ? params.error : undefined;
  const upgradeMsg = typeof params.upgrade === "string" ? params.upgrade : undefined;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 2. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // If profile doesn't exist or is incomplete, redirect to onboarding
  if (!profile || !profile.full_name || !profile.currency) {
    redirect("/onboarding");
  }

  const currency = profile.currency;
  const isPro = profile.billing_tier === "pro";

  // 3. Fetch templates for lazy transaction generation
  const { data: incomesRaw } = await supabase
    .from("incomes")
    .select("*")
    .eq("user_id", user.id);

  let subscriptionsRaw: any[] = [];
  if (isPro) {
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id);
    subscriptionsRaw = subs || [];
  }

  // 4. Lazy evaluation: Generate transaction ledger entries for due schedules
  const todayStr = new Date().toISOString().split("T")[0];
  const transactionsToInsert: any[] = [];
  const incomesToUpdate: { id: string; next_pay_date: string }[] = [];
  const subsToUpdate: { id: string; next_payment_date: string }[] = [];

  // Evaluate incomes
  for (const inc of incomesRaw || []) {
    let nextDate = inc.next_pay_date;
    let dateChanged = false;
    let safetyCounter = 0;

    while (nextDate <= todayStr) {
      safetyCounter++;
      if (safetyCounter > 300) {
        console.warn("Safety trigger: breaking out of potential infinite loop for income", inc.id);
        break;
      }
      transactionsToInsert.push({
        user_id: user.id,
        title: inc.source,
        amount: Number(inc.amount), // positive for income
        category: "ingreso",
        date: nextDate,
        status: "paid", // incomes are paid/cleared automatically
        source_type: "income_recurring",
        source_id: inc.id,
      });
      const prevDate = nextDate;
      nextDate = getNextDate(nextDate, inc.frequency);
      dateChanged = true;
      if (nextDate === prevDate) {
        nextDate = "9999-12-31";
      }
    }

    if (dateChanged) {
      incomesToUpdate.push({ id: inc.id, next_pay_date: nextDate });
    }
  }

  // Evaluate subscriptions
  for (const sub of subscriptionsRaw || []) {
    if (sub.status !== "active") continue;
    let nextDate = sub.next_payment_date;
    let dateChanged = false;
    let safetyCounter = 0;

    while (nextDate <= todayStr) {
      safetyCounter++;
      if (safetyCounter > 300) {
        console.warn("Safety trigger: breaking out of potential infinite loop for subscription", sub.id);
        break;
      }
      transactionsToInsert.push({
        user_id: user.id,
        title: sub.name,
        amount: -Number(sub.amount), // negative for expenses
        category: sub.category || "entretenimiento",
        date: nextDate,
        status: "paid", // subscriptions are auto-debited (paid)
        source_type: "subscription_recurring",
        source_id: sub.id,
      });
      const prevDate = nextDate;
      nextDate = getNextDate(nextDate, sub.billing_cycle);
      dateChanged = true;
      if (nextDate === prevDate) {
        nextDate = "9999-12-31";
      }
    }

    if (dateChanged) {
      subsToUpdate.push({ id: sub.id, next_payment_date: nextDate });
    }
  }

  // Push updates to database if there are any
  if (transactionsToInsert.length > 0) {
    await supabase.from("transactions").insert(transactionsToInsert);
  }
  for (const incUpdate of incomesToUpdate) {
    await supabase
      .from("incomes")
      .update({ next_pay_date: incUpdate.next_pay_date })
      .eq("id", incUpdate.id);
  }
  for (const subUpdate of subsToUpdate) {
    await supabase
      .from("subscriptions")
      .update({ next_payment_date: subUpdate.next_payment_date })
      .eq("id", subUpdate.id);
  }

  // 5. Fetch final lists
  const { data: incomes } = await supabase
    .from("incomes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  let { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  // 5.5 Deduplicate existing recurring transactions to clean up any past infinite loops/repeats
  if (transactions && transactions.length > 0) {
    const seen = new Set<string>();
    const idsToDelete: string[] = [];

    for (const tx of transactions) {
      if (tx.source_id && (tx.source_type === "income_recurring" || tx.source_type === "subscription_recurring")) {
        const key = `${tx.source_id}-${tx.source_type}-${tx.date}`;
        if (seen.has(key)) {
          idsToDelete.push(tx.id);
        } else {
          seen.add(key);
        }
      }
    }

    if (idsToDelete.length > 0) {
      await supabase.from("transactions").delete().in("id", idsToDelete);
      // Fetch clean list
      const { data: cleanTx } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });
      transactions = cleanTx;
    }
  }

  // 6. Calculate stats
  // 6.1 Balance Real (Actual cash-in-hand based on all completed/paid transactions in the system)
  const balanceReal = (transactions || [])
    .filter((tx) => tx.status === "paid")
    .reduce((acc, tx) => acc + Number(tx.amount), 0);

  // 6.2 Monthly stats based on current month's transactions
  const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"

  // 6.3 Projected Monthly Base Income (Incomes templates prorated equivalent monthly)
  const totalIncomesBase = (incomes || []).reduce((acc, inc) => {
    const amt = Number(inc.amount);
    if (inc.frequency === "weekly") return acc + (amt * 52) / 12;
    if (inc.frequency === "bi-weekly") return acc + (amt * 26) / 12;
    return acc + amt; // monthly or one-time
  }, 0);

  // 6.4 Projected Monthly Base Subscriptions (Subscriptions templates prorated equivalent monthly)
  const totalSubscriptionsBase = (subscriptions || []).reduce((acc, sub) => {
    const amt = Number(sub.amount);
    if (sub.billing_cycle === "daily") return acc + (amt * 365) / 12;
    if (sub.billing_cycle === "weekly") return acc + (amt * 52) / 12;
    if (sub.billing_cycle === "bi-weekly") return acc + (amt * 26) / 12;
    if (sub.billing_cycle === "yearly") return acc + amt / 12;
    return acc + amt; // monthly
  }, 0);

  // 6.5 Real manual payments made (and paid) in the current month
  const totalPaymentsCurrentMonth = (transactions || [])
    .filter((tx) => tx.source_type === "manual_expense" && tx.status === "paid" && tx.date.startsWith(currentMonthStr))
    .reduce((acc, tx) => acc + Math.abs(Number(tx.amount)), 0);

  // 6.6 Balance Libre Neto = totalIncomesBase - totalSubscriptionsBase - totalPaymentsCurrentMonth
  const netBalance = totalIncomesBase - totalSubscriptionsBase - totalPaymentsCurrentMonth;

  // 6.7 Real Income this month (Actual income transactions marked as paid)
  const totalIncomeReal = (transactions || [])
    .filter((tx) => tx.amount > 0 && tx.status === "paid" && tx.date.startsWith(currentMonthStr))
    .reduce((acc, tx) => acc + Number(tx.amount), 0);

  // 6.8 Egresos reales transcurridos desde el último día de cobro (paid)
  const pastIncomes = (transactions || [])
    .filter((tx) => tx.amount > 0 && tx.date <= todayStr)
    .sort((a, b) => b.date.localeCompare(a.date));

  const lastIncomeTx = pastIncomes[0];
  let totalExpensesSinceLastIncome = 0;
  let lastIncomeDateText = "sin ingresos";

  if (lastIncomeTx) {
    const lastIncomeDate = lastIncomeTx.date;
    lastIncomeDateText = lastIncomeDate;
    totalExpensesSinceLastIncome = (transactions || [])
      .filter((tx) => tx.amount < 0 && tx.status === "paid" && tx.date >= lastIncomeDate)
      .reduce((acc, tx) => acc + Math.abs(Number(tx.amount)), 0);
  } else {
    // Fallback to monthly paid expenses
    const totalPaymentsFallback = (transactions || [])
      .filter((tx) => tx.source_type === "manual_expense" && tx.status === "paid" && tx.date.startsWith(currentMonthStr))
      .reduce((acc, tx) => acc + Math.abs(Number(tx.amount)), 0);

    const totalSubscriptionsFallback = (transactions || [])
      .filter((tx) => tx.source_type === "subscription_recurring" && tx.status === "paid" && tx.date.startsWith(currentMonthStr))
      .reduce((acc, tx) => acc + Math.abs(Number(tx.amount)), 0);

    totalExpensesSinceLastIncome = totalPaymentsFallback + totalSubscriptionsFallback;
  }

  return (
    <DashboardClient
      profile={profile}
      incomes={incomes || []}
      payments={transactions || []} // pass unified transactions ledger instead of payments
      subscriptions={subscriptions || []}
      isPro={isPro}
      currency={currency}
      totalIncome={totalIncomeReal}
      totalIncomeBase={totalIncomesBase}
      totalPayments={totalPaymentsCurrentMonth}
      totalSubscriptions={totalSubscriptionsBase}
      netBalance={netBalance}
      balanceReal={balanceReal}
      totalExpensesSinceLastIncome={totalExpensesSinceLastIncome}
      lastIncomeDateText={lastIncomeDateText}
      errorMsg={errorMsg}
      upgradeMsg={upgradeMsg}
    />
  );
}
