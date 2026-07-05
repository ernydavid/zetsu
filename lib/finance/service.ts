import "server-only";

import { addCadence, buildAnchorDate, inferScheduledStatus, monthStartIso, todayIso } from "@/lib/finance/dates";
import type {
  FinanceAccount,
  FinanceBudgetCategoryMonth,
  FinanceBudgetMonth,
  FinanceCategory,
  FinanceProfile,
  FinanceRecurringRule,
  FinanceTransaction,
  RecurringCadence,
  TransactionKind,
} from "@/lib/finance/types";

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "vivienda", group_name: "fijos" },
  { name: "servicios", group_name: "fijos" },
  { name: "comida", group_name: "variables" },
  { name: "transporte", group_name: "variables" },
  { name: "salud", group_name: "variables" },
  { name: "entretenimiento", group_name: "variables" },
  { name: "deuda", group_name: "finanzas" },
  { name: "otros", group_name: "variables" },
] as const;

export async function ensureFinanceSetup(
  supabase: any,
  userId: string,
  currency: string,
  fullName?: string | null,
  openingBalance = 0,
) {
  const { data: existingAccounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  let primaryAccount = existingAccounts?.[0] ?? null;

  if (!primaryAccount) {
    const { data } = await supabase
      .from("accounts")
      .insert({
        user_id: userId,
        name: fullName ? `Cuenta principal de ${fullName.split(" ")[0]}` : "Cuenta principal",
        type: "checking",
        currency,
        opening_balance: openingBalance,
        include_in_budget: true,
      })
      .select("*")
      .single();

    primaryAccount = data;
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .is("archived_at", null);

  if (!categories || categories.length === 0) {
    await supabase.from("categories").insert([
      {
        user_id: userId,
        name: "ingreso",
        kind: "income",
        group_name: "ingresos",
      },
      ...DEFAULT_EXPENSE_CATEGORIES.map((category) => ({
        user_id: userId,
        name: category.name,
        kind: "expense",
        group_name: category.group_name,
      })),
    ]);
  }

  return primaryAccount as FinanceAccount;
}

export async function getProfileOrRedirect(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return profile as FinanceProfile | null;
}

export async function getFinanceSnapshot(supabase: any, userId: string) {
  const [
    profileResult,
    accountsResult,
    categoriesResult,
    rulesResult,
    transactionsResult,
    budgetMonthResult,
    budgetValuesResult,
    reconciliationsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("accounts").select("*").eq("user_id", userId).is("archived_at", null).order("created_at", { ascending: true }),
    supabase.from("categories").select("*").eq("user_id", userId).is("archived_at", null).order("name", { ascending: true }),
    supabase.from("recurring_rules").select("*").eq("user_id", userId).is("archived_at", null).order("created_at", { ascending: true }),
    supabase.from("transactions").select("*").eq("user_id", userId).neq("status", "cancelled").order("transaction_date", { ascending: false }),
    supabase.from("budget_months").select("*").eq("user_id", userId).eq("month", monthStartIso()).maybeSingle(),
    supabase.from("budget_category_months").select("*"),
    supabase.from("reconciliations").select("*").eq("user_id", userId).order("statement_ending_date", { ascending: false }),
  ]);

  let budgetMonth = budgetMonthResult.data as FinanceBudgetMonth | null;

  if (!budgetMonth) {
    const created = await supabase
      .from("budget_months")
      .insert({ user_id: userId, month: monthStartIso() })
      .select("*")
      .single();
    budgetMonth = created.data as FinanceBudgetMonth;
  }

  let budgetValues = budgetValuesResult.data as FinanceBudgetCategoryMonth[] | null;
  if (!budgetValues || budgetValues.length === 0) {
    const categories = (categoriesResult.data as FinanceCategory[] | null) ?? [];
    const expenseCategories = categories.filter((category) => category.kind === "expense");
    if (expenseCategories.length > 0) {
      await supabase.from("budget_category_months").insert(
        expenseCategories.map((category) => ({
          budget_month_id: budgetMonth.id,
          category_id: category.id,
          assigned: 0,
          target_amount: 0,
          rollover_enabled: true,
        })),
      );
      const refreshed = await supabase
        .from("budget_category_months")
        .select("*")
        .eq("budget_month_id", budgetMonth.id);
      budgetValues = refreshed.data as FinanceBudgetCategoryMonth[];
    } else {
      budgetValues = [];
    }
  } else {
    budgetValues = budgetValues.filter((value) => value.budget_month_id === budgetMonth?.id);
  }

  return {
    profile: profileResult.data as FinanceProfile | null,
    accounts: (accountsResult.data ?? []) as FinanceAccount[],
    categories: (categoriesResult.data ?? []) as FinanceCategory[],
    recurringRules: (rulesResult.data ?? []) as FinanceRecurringRule[],
    transactions: (transactionsResult.data ?? []) as FinanceTransaction[],
    budgetMonth,
    budgetValues,
    reconciliations: reconciliationsResult.data ?? [],
  };
}

export async function findCategoryByName(
  supabase: any,
  userId: string,
  name: string,
  kind: "income" | "expense",
) {
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .eq("name", name)
    .eq("kind", kind)
    .maybeSingle();

  if (data) {
    return data as FinanceCategory;
  }

  const { data: created } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      name,
      kind,
      group_name: kind === "income" ? "ingresos" : "variables",
    })
    .select("*")
    .single();

  return created as FinanceCategory;
}

export async function upsertRecurringRule(params: {
  supabase: any;
  userId: string;
  ruleId?: string;
  accountId: string;
  categoryId: string | null;
  categoryName?: string | null;
  kind: TransactionKind;
  name: string;
  amount: number;
  cadence: RecurringCadence;
  anchorDate: string;
  transferAccountId?: string | null;
  notes?: string | null;
}) {
  const payload = {
    user_id: params.userId,
    account_id: params.accountId,
    category_id: params.categoryId,
    kind: params.kind,
    name: params.name,
    amount: params.amount,
    cadence: params.cadence,
    anchor_date: params.anchorDate,
    next_occurrence: params.anchorDate,
    active: true,
    transfer_account_id: params.transferAccountId ?? null,
    notes: params.notes ?? null,
    archived_at: null,
    updated_at: new Date().toISOString(),
  };

  if (params.ruleId) {
    await params.supabase
      .from("transactions")
      .delete()
      .eq("recurring_rule_id", params.ruleId)
      .in("status", ["scheduled", "pending"]);

    const { data } = await params.supabase
      .from("recurring_rules")
      .update(payload)
      .eq("id", params.ruleId)
      .eq("user_id", params.userId)
      .select("*")
      .single();

    await materializeRecurringRuleOccurrences(params.supabase, data, 120);
    return data as FinanceRecurringRule;
  }

  const { data } = await params.supabase
    .from("recurring_rules")
    .insert(payload)
    .select("*")
    .single();

  await materializeRecurringRuleOccurrences(params.supabase, data, 120);
  return data as FinanceRecurringRule;
}

export async function materializeRecurringRuleOccurrences(
  supabase: any,
  rule: FinanceRecurringRule,
  horizonDays = 120,
) {
  if (!rule.active || rule.archived_at) {
    return;
  }

  const startDate = rule.next_occurrence || rule.anchor_date;
  const limitDate = new Date();
  limitDate.setUTCDate(limitDate.getUTCDate() + horizonDays);
  const limitIso = limitDate.toISOString().split("T")[0];

  const { data: existingTransactions } = await supabase
    .from("transactions")
    .select("transaction_date, status")
    .eq("recurring_rule_id", rule.id)
    .neq("status", "cancelled");

  const existingDates = new Set(
    (existingTransactions ?? []).map((transaction: { transaction_date: string }) => transaction.transaction_date),
  );

  const toInsert = [];
  let occurrence = startDate;

  while (occurrence <= limitIso) {
    if (!existingDates.has(occurrence)) {
      toInsert.push({
        user_id: rule.user_id,
        account_id: rule.account_id,
        amount: Number(rule.amount),
        kind: rule.kind,
        status: inferScheduledStatus(occurrence),
        transaction_date: occurrence,
        posted_date: null,
        category_id: rule.category_id,
        category: paramsCategoryName(rule),
        recurring_rule_id: rule.id,
        transfer_account_id: rule.transfer_account_id ?? null,
        title: rule.name,
        notes: rule.notes ?? null,
        source_type: rule.kind === "income" ? "income_recurring" : "subscription_recurring",
      });
    }

    const nextOccurrence = addCadence(occurrence, rule.cadence);
    if (nextOccurrence === occurrence) {
      break;
    }
    occurrence = nextOccurrence;
  }

  if (toInsert.length > 0) {
    await supabase.from("transactions").insert(toInsert);
  }

  const { data: nextRows } = await supabase
    .from("transactions")
    .select("transaction_date")
    .eq("recurring_rule_id", rule.id)
    .in("status", ["scheduled", "pending"])
    .gte("transaction_date", todayIso())
    .order("transaction_date", { ascending: true })
    .limit(1);

  const nextOccurrence = nextRows?.[0]?.transaction_date ?? startDate;

  await supabase
    .from("recurring_rules")
    .update({
      next_occurrence: nextOccurrence,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rule.id);
}

export async function materializeAllRecurringRules(supabase: any, userId: string, horizonDays = 120) {
  const { data: rules } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .is("archived_at", null);

  for (const rule of rules ?? []) {
    await materializeRecurringRuleOccurrences(supabase, rule as FinanceRecurringRule, horizonDays);
  }
}

export async function archiveRecurringRule(supabase: any, userId: string, ruleId: string) {
  await supabase
    .from("transactions")
    .update({ status: "cancelled" })
    .eq("recurring_rule_id", ruleId)
    .in("status", ["scheduled", "pending"]);

  await supabase
    .from("recurring_rules")
    .update({
      active: false,
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId)
    .eq("user_id", userId);
}

export function buildRecurringAnchorFromForm(dayValue: string, cadence: RecurringCadence) {
  const parsed = Math.max(1, Math.min(31, Number.parseInt(dayValue || "1", 10) || 1));
  const anchor = buildAnchorDate(parsed);
  return cadence === "daily" || cadence === "weekly" ? todayIso() : anchor;
}

function paramsCategoryName(rule: FinanceRecurringRule) {
  if (rule.kind === "income") {
    return "ingreso";
  }

  return "otros";
}
