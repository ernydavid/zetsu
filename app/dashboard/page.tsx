import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardClient } from "@/app/dashboard/dashboard-client";
import {
  computeAvailableBalance,
  computeAvailableAfterDebtMinimums,
  computeAvailableToBudget,
  computeDebtTotals,
  computeBudgetRows,
  computeNetWorth,
  computePeriodTotals,
  computeProjectedCashflow,
  computeRunwayDays,
} from "@/lib/finance/calculations";
import { monthEndIso, monthStartIso } from "@/lib/finance/dates";
import { buildCategoryLibrary, getRecurringRuleScheduleDays } from "@/lib/finance/recurring";
import { ensureFinanceSetup, getFinanceSnapshot } from "@/lib/finance/service";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function mapRecurringIncome(rule: any) {
  return {
    id: rule.id,
    source: rule.name,
    amount: Number(rule.amount),
    frequency: rule.cadence,
    next_pay_date: rule.next_occurrence,
    schedule_days: getRecurringRuleScheduleDays(rule),
  };
}

function mapRecurringExpense(rule: any, categoryName: string) {
  return {
    id: rule.id,
    name: rule.name,
    amount: Number(rule.amount),
    billing_cycle: rule.cadence,
    next_payment_date: rule.next_occurrence,
    category: categoryName,
  };
}

function mapTransaction(tx: any, categoryName: string | null) {
  const signedAmount =
    tx.kind === "income" ? Number(tx.amount) : tx.kind === "expense" ? -Number(tx.amount) : 0;
  const isPaid = tx.status === "posted" || tx.status === "reconciled";

  return {
    id: tx.id,
    title: tx.title,
    amount: signedAmount,
    origin: tx.origin,
    date: tx.transaction_date,
    created_at: tx.created_at,
    category: categoryName ?? "otros",
    status: isPaid ? "paid" : "unpaid",
    source_type:
      tx.origin === "synced"
        ? "synced_transaction"
        : tx.kind === "income"
        ? tx.recurring_rule_id
          ? "income_recurring"
          : "manual_income"
        : tx.kind === "expense"
          ? tx.recurring_rule_id
            ? "subscription_recurring"
            : "manual_expense"
          : "manual_transfer",
    source_id: tx.recurring_rule_id,
  };
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorMsg = typeof params.error === "string" ? params.error : undefined;
  const upgradeMsg = typeof params.upgrade === "string" ? params.upgrade : undefined;
  const startTour = params.tour === "1";

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

  await ensureFinanceSetup(
    supabase,
    user.id,
    snapshot.profile.base_currency,
    snapshot.profile.full_name,
  );

  const currentMonthStart = monthStartIso();
  const currentMonthEnd = monthEndIso();
  const { income: monthlyIncome, expenses: monthlyExpenses } = computePeriodTotals(
    snapshot.transactions,
    currentMonthStart,
    currentMonthEnd,
  );

  const budgetRows = computeBudgetRows({
    categories: snapshot.categories,
    budgetValues: snapshot.budgetValues,
    transactions: snapshot.transactions,
  });

  const availableBalance = computeAvailableBalance(snapshot.accounts, snapshot.transactions);
  const netWorth = computeNetWorth(snapshot.accounts, snapshot.transactions);
  const availableToBudget = computeAvailableToBudget(
    snapshot.accounts,
    snapshot.transactions,
    budgetRows,
  );
  const availableAfterDebtMinimums = computeAvailableAfterDebtMinimums(
    snapshot.accounts,
    snapshot.transactions,
    snapshot.debtObligations,
  );
  const debtTotals = computeDebtTotals(snapshot.debtObligations);
  const projectedCashflow = computeProjectedCashflow(snapshot.transactions, snapshot.recurringRules, 30);
  const runwayDays = computeRunwayDays(availableBalance, monthlyExpenses);

  const categoryMap = new Map(snapshot.categories.map((category) => [category.id, category.name]));

  const incomeRules = snapshot.recurringRules.filter((rule) => rule.kind === "income" && rule.active);
  const expenseRules = snapshot.recurringRules.filter((rule) => rule.kind === "expense" && rule.active);
  const transformedTransactions = snapshot.transactions.map((tx) =>
    mapTransaction(tx, tx.category_id ? categoryMap.get(tx.category_id) ?? null : null),
  );
  const expenseCategoryLibrary = buildCategoryLibrary(
    snapshot.categories
      .filter((category) => category.kind === "expense")
      .map((category) => category.name),
  );

  return (
    <DashboardClient
      profile={snapshot.profile}
      incomes={incomeRules.map(mapRecurringIncome)}
      payments={transformedTransactions}
      subscriptions={expenseRules.map((rule) =>
        mapRecurringExpense(rule, rule.category_id ? categoryMap.get(rule.category_id) ?? "otros" : "otros"),
      )}
      expenseCategoryLibrary={expenseCategoryLibrary}
      isPro={snapshot.profile.billing_tier === "pro"}
      currency={snapshot.profile.base_currency}
      availableBalance={availableBalance}
      netWorth={netWorth}
      monthlyIncome={monthlyIncome}
      monthlyExpenses={monthlyExpenses}
      availableToBudget={availableToBudget}
      availableAfterDebtMinimums={availableAfterDebtMinimums}
      totalDebtOutstanding={debtTotals.outstanding}
      debtMinimums={debtTotals.minimums}
      projectedCashflow={projectedCashflow}
      runwayDays={runwayDays}
      errorMsg={errorMsg}
      upgradeMsg={upgradeMsg}
      startTour={startTour}
    />
  );
}
