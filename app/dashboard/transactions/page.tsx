import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { TransactionsClient } from "./transactions-client";
import { getFinanceSnapshot } from "@/lib/finance/service";

export default async function TransactionsPage() {
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
    date: tx.transaction_date,
    created_at: tx.created_at,
    category: tx.category_id ? categoryMap.get(tx.category_id) ?? "otros" : "otros",
    status: tx.status === "posted" || tx.status === "reconciled" ? "paid" : "unpaid",
    source_type:
      tx.kind === "income"
        ? tx.recurring_rule_id
          ? "income_recurring"
          : "manual_income"
        : tx.kind === "expense"
          ? tx.recurring_rule_id
            ? "subscription_recurring"
            : "manual_expense"
          : "manual_transfer",
    source_id: tx.recurring_rule_id,
  }));

  return (
    <TransactionsClient
      profile={snapshot.profile}
      incomes={incomes}
      payments={payments}
      subscriptions={subscriptions}
      isPro={snapshot.profile.billing_tier === "pro"}
      currency={snapshot.profile.base_currency}
    />
  );
}
