import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { TransactionsClient } from "./transactions-client";
import { getFinanceSnapshot } from "@/lib/finance/service";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorMsg = typeof params.error === "string" ? params.error : undefined;
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

  const categoryMap = new Map(snapshot.categories.map((category) => [category.id, category.name]));
  const debtMap = new Map(snapshot.debtObligations.map((debt) => [debt.id, debt]));
  const allocationMap = new Map(snapshot.debtAllocations.map((allocation) => [allocation.transaction_id, allocation]));

  const incomes = snapshot.recurringRules
    .filter((rule) => rule.kind === "income")
    .map((rule) => ({
      id: rule.id,
      source: rule.name,
      amount: Number(rule.amount),
      frequency: rule.cadence,
      next_pay_date: rule.next_occurrence,
    }));

  const subscriptions = snapshot.recurringRules
    .filter((rule) => rule.kind === "expense")
    .map((rule) => ({
      id: rule.id,
      name: rule.name,
      amount: Number(rule.amount),
      billing_cycle: rule.cadence,
      next_payment_date: rule.next_occurrence,
      category: rule.category_id ? categoryMap.get(rule.category_id) ?? "otros" : "otros",
    }));

  const payments = snapshot.transactions.map((tx) => ({
    id: tx.id,
    title: tx.title,
    amount: tx.kind === "income" ? Number(tx.amount) : tx.kind === "expense" ? -Number(tx.amount) : 0,
    origin: tx.origin,
    date: tx.transaction_date,
    created_at: tx.created_at,
    category: tx.category_id ? categoryMap.get(tx.category_id) ?? "otros" : "otros",
    status: tx.status === "posted" || tx.status === "reconciled" ? "paid" : "unpaid",
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
    debt_allocation: allocationMap.get(tx.id)
      ? {
          ...allocationMap.get(tx.id),
          debt_name: debtMap.get(allocationMap.get(tx.id)!.debt_obligation_id)?.name ?? null,
        }
      : null,
  }));

  return (
    <TransactionsClient
      profile={snapshot.profile}
      incomes={incomes}
      payments={payments}
      subscriptions={subscriptions}
      debtObligations={snapshot.debtObligations}
      isPro={snapshot.profile.billing_tier === "pro"}
      currency={snapshot.profile.base_currency}
      errorMsg={errorMsg}
    />
  );
}
