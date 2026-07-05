"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  archiveRecurringRule,
  buildRecurringAnchorFromForm,
  ensureFinanceSetup,
  findCategoryByName,
  getProfileOrRedirect,
  materializeAllRecurringRules,
  upsertRecurringRule,
} from "@/lib/finance/service";

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function normalizeAmount(value: FormDataEntryValue | null) {
  return Number.parseFloat(typeof value === "string" ? value : "");
}

function buildPendingStatus(date: string) {
  return date > todayIso() ? "scheduled" : "pending";
}

async function getFinanceContext() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  const profile = await getProfileOrRedirect(supabase, user.id);
  if (!profile) {
    redirect("/dashboard?error=Perfil+no+encontrado");
  }

  const primaryAccount = await ensureFinanceSetup(
    supabase,
    user.id,
    profile.base_currency,
    profile.full_name,
  );

  return { supabase, user, profile, primaryAccount };
}

async function createManualTransaction(params: {
  supabase: any;
  userId: string;
  accountId: string;
  title: string;
  amount: number;
  kind: "income" | "expense" | "transfer";
  categoryId: string | null;
  categoryName: string;
  transactionDate: string;
  sourceType: string;
  transferAccountId?: string | null;
  notes?: string | null;
}) {
  const status =
    params.kind === "income" ? "posted" : buildPendingStatus(params.transactionDate);

  const postedDate = status === "posted" ? params.transactionDate : null;

  const { error } = await params.supabase.from("transactions").insert({
    user_id: params.userId,
    account_id: params.accountId,
    title: params.title,
    amount: params.amount,
    kind: params.kind,
    status,
    transaction_date: params.transactionDate,
    posted_date: postedDate,
    category_id: params.categoryId,
    category: params.categoryName,
    transfer_account_id: params.transferAccountId ?? null,
    notes: params.notes ?? null,
    source_type: params.sourceType,
  });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }
}

async function deleteTransactionById(supabase: any, userId: string, id: string) {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }
}

export async function addIncome(formData: FormData): Promise<void> {
  const { supabase, user, primaryAccount } = await getFinanceContext();
  const source = String(formData.get("source") || "").trim();
  const amount = normalizeAmount(formData.get("amount"));
  const isRecurring = formData.get("is_recurring") === "true" || formData.get("is_recurring") === "on";

  if (!source || Number.isNaN(amount) || amount <= 0) {
    redirect("/dashboard?error=Datos+de+ingreso+inválidos");
  }

  const category = await findCategoryByName(supabase, user.id, "ingreso", "income");

  if (isRecurring) {
    const cadence = String(formData.get("frequency") || "monthly") as
      | "weekly"
      | "bi-weekly"
      | "monthly"
      | "one-time";
    const anchorDate = buildRecurringAnchorFromForm(
      String(formData.get("day_of_month") || "1"),
      cadence,
    );

    await upsertRecurringRule({
      supabase,
      userId: user.id,
      accountId: primaryAccount.id,
      categoryId: category.id,
      kind: "income",
      name: source,
      amount,
      cadence,
      anchorDate,
    });
  } else {
    await createManualTransaction({
      supabase,
      userId: user.id,
      accountId: primaryAccount.id,
      title: source,
      amount,
      kind: "income",
      categoryId: category.id,
      categoryName: category.name,
      transactionDate: String(formData.get("next_pay_date") || todayIso()),
      sourceType: "manual_income",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/budget");
}

export async function editIncome(formData: FormData): Promise<void> {
  const { supabase, user, primaryAccount } = await getFinanceContext();
  const id = String(formData.get("id") || "").trim();
  const source = String(formData.get("source") || "").trim();
  const amount = normalizeAmount(formData.get("amount"));
  const isRecurring = formData.get("is_recurring") === "true" || formData.get("is_recurring") === "on";

  if (!id || !source || Number.isNaN(amount) || amount <= 0) {
    redirect("/dashboard?error=Datos+de+ingreso+inválidos");
  }

  const category = await findCategoryByName(supabase, user.id, "ingreso", "income");

  const { data: existingRule } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (isRecurring) {
    const cadence = String(formData.get("frequency") || "monthly") as
      | "weekly"
      | "bi-weekly"
      | "monthly"
      | "one-time";
    const anchorDate = buildRecurringAnchorFromForm(
      String(formData.get("day_of_month") || "1"),
      cadence,
    );

    await upsertRecurringRule({
      supabase,
      userId: user.id,
      ruleId: existingRule?.id ?? undefined,
      accountId: primaryAccount.id,
      categoryId: category.id,
      kind: "income",
      name: source,
      amount,
      cadence,
      anchorDate,
    });

    if (!existingRule) {
      await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("kind", "income");
    }
  } else if (existingRule) {
    await archiveRecurringRule(supabase, user.id, existingRule.id);
    await createManualTransaction({
      supabase,
      userId: user.id,
      accountId: primaryAccount.id,
      title: source,
      amount,
      kind: "income",
      categoryId: category.id,
      categoryName: category.name,
      transactionDate: String(formData.get("next_pay_date") || todayIso()),
      sourceType: "manual_income",
    });
  } else {
    const { error } = await supabase
      .from("transactions")
      .update({
        title: source,
        amount,
        category_id: category.id,
        category: category.name,
        transaction_date: String(formData.get("next_pay_date") || todayIso()),
        posted_date: String(formData.get("next_pay_date") || todayIso()),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("kind", "income");

    if (error) {
      redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/accounts");
}

export async function deleteIncome(id: string): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  const { data: existingRule } = await supabase
    .from("recurring_rules")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("kind", "income")
    .maybeSingle();

  if (existingRule) {
    await archiveRecurringRule(supabase, user.id, id);
  } else {
    await deleteTransactionById(supabase, user.id, id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/accounts");
}

export async function addPayment(formData: FormData): Promise<void> {
  const { supabase, user, profile, primaryAccount } = await getFinanceContext();
  const title = String(formData.get("title") || "").trim();
  const amount = normalizeAmount(formData.get("amount"));
  const categoryName = String(formData.get("category") || "otros").trim().toLowerCase();
  const isRecurring = formData.get("is_recurring") === "true" || formData.get("is_recurring") === "on";

  if (!title || Number.isNaN(amount) || amount <= 0) {
    redirect("/dashboard?error=Datos+de+gasto+inválidos");
  }

  const category = await findCategoryByName(supabase, user.id, categoryName || "otros", "expense");

  if (isRecurring) {
    if (profile.billing_tier !== "pro") {
      redirect("/dashboard?error=Se+requiere+el+plan+Pro+para+automatizar+gastos+recurrentes");
    }

    const cadence = String(formData.get("billing_cycle") || "monthly") as
      | "daily"
      | "weekly"
      | "bi-weekly"
      | "monthly"
      | "yearly";
    const anchorDate = buildRecurringAnchorFromForm(
      String(formData.get("day_of_month") || "1"),
      cadence,
    );

    await upsertRecurringRule({
      supabase,
      userId: user.id,
      accountId: primaryAccount.id,
      categoryId: category.id,
      kind: "expense",
      name: title,
      amount,
      cadence,
      anchorDate,
    });
  } else {
    const transactionDate = String(formData.get("next_pay_date") || todayIso());
    await createManualTransaction({
      supabase,
      userId: user.id,
      accountId: primaryAccount.id,
      title,
      amount,
      kind: "expense",
      categoryId: category.id,
      categoryName: category.name,
      transactionDate,
      sourceType: "manual_expense",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/budget");
}

export async function togglePaymentStatus(id: string, currentStatus: string): Promise<void> {
  const { supabase, user } = await getFinanceContext();

  const { data: transaction } = await supabase
    .from("transactions")
    .select("transaction_date")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!transaction) {
    redirect("/dashboard?error=Transacción+no+encontrada");
  }

  const nextStatus =
    currentStatus === "posted" || currentStatus === "reconciled"
      ? buildPendingStatus(transaction.transaction_date)
      : "posted";

  const { error } = await supabase
    .from("transactions")
    .update({
      status: nextStatus,
      posted_date: nextStatus === "posted" ? todayIso() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/budget");
}

export async function deletePayment(id: string): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  await deleteTransactionById(supabase, user.id, id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/budget");
}

export async function addSubscription(formData: FormData): Promise<void> {
  await addPayment(formData);
}

export async function deleteSubscription(id: string): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  await archiveRecurringRule(supabase, user.id, id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/subscriptions");
  revalidatePath("/dashboard/accounts");
}

export async function editSubscription(formData: FormData): Promise<void> {
  const { supabase, user, profile, primaryAccount } = await getFinanceContext();
  const id = String(formData.get("id") || "").trim();
  const title = String(formData.get("name") || "").trim();
  const amount = normalizeAmount(formData.get("amount"));
  const categoryName = String(formData.get("category") || "otros").trim().toLowerCase();
  const isRecurring = formData.get("is_recurring") === "true" || formData.get("is_recurring") === "on";

  if (!id || !title || Number.isNaN(amount) || amount <= 0) {
    redirect("/dashboard?error=Datos+de+suscripción+inválidos");
  }

  const category = await findCategoryByName(supabase, user.id, categoryName || "otros", "expense");

  if (isRecurring) {
    if (profile.billing_tier !== "pro") {
      redirect("/dashboard?error=Se+requiere+el+plan+Pro+para+editar+suscripciones");
    }

    const cadence = String(formData.get("billing_cycle") || "monthly") as
      | "daily"
      | "weekly"
      | "bi-weekly"
      | "monthly"
      | "yearly";
    const anchorDate = buildRecurringAnchorFromForm(
      String(formData.get("day_of_month") || "1"),
      cadence,
    );

    await upsertRecurringRule({
      supabase,
      userId: user.id,
      ruleId: id,
      accountId: primaryAccount.id,
      categoryId: category.id,
      kind: "expense",
      name: title,
      amount,
      cadence,
      anchorDate,
    });
  } else {
    await archiveRecurringRule(supabase, user.id, id);
    await createManualTransaction({
      supabase,
      userId: user.id,
      accountId: primaryAccount.id,
      title,
      amount,
      kind: "expense",
      categoryId: category.id,
      categoryName: category.name,
      transactionDate: String(formData.get("next_pay_date") || todayIso()),
      sourceType: "manual_expense",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/subscriptions");
  revalidatePath("/dashboard/accounts");
}

export async function addAccount(formData: FormData): Promise<void> {
  const { supabase, user, profile } = await getFinanceContext();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "checking");
  const openingBalance = normalizeAmount(formData.get("opening_balance"));
  const includeInBudget = formData.get("include_in_budget") === "on";

  if (!name || Number.isNaN(openingBalance)) {
    redirect("/dashboard/accounts?error=Datos+de+cuenta+inválidos");
  }

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name,
    type,
    currency: profile.base_currency,
    opening_balance: openingBalance,
    include_in_budget: includeInBudget,
  });

  if (error) {
    redirect(`/dashboard/accounts?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
}

export async function addTransfer(formData: FormData): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  const fromAccountId = String(formData.get("from_account_id") || "");
  const toAccountId = String(formData.get("to_account_id") || "");
  const amount = normalizeAmount(formData.get("amount"));
  const transactionDate = String(formData.get("transaction_date") || todayIso());
  const notes = String(formData.get("notes") || "").trim();

  if (!fromAccountId || !toAccountId || fromAccountId === toAccountId || Number.isNaN(amount) || amount <= 0) {
    redirect("/dashboard/accounts?error=Transferencia+inválida");
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: fromAccountId,
    transfer_account_id: toAccountId,
    title: "Transferencia",
    amount,
    kind: "transfer",
    status: "posted",
    transaction_date: transactionDate,
    posted_date: transactionDate,
    category: "transferencia",
    notes: notes || null,
    source_type: "manual_transfer",
  });

  if (error) {
    redirect(`/dashboard/accounts?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
}

export async function reconcileAccount(formData: FormData): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  const accountId = String(formData.get("account_id") || "");
  const statementEndingDate = String(formData.get("statement_ending_date") || todayIso());
  const statementBalance = normalizeAmount(formData.get("statement_balance"));
  const reconciledBalance = normalizeAmount(formData.get("reconciled_balance"));

  if (!accountId || Number.isNaN(statementBalance) || Number.isNaN(reconciledBalance)) {
    redirect("/dashboard/accounts?error=Datos+de+conciliación+inválidos");
  }

  await supabase.from("reconciliations").insert({
    user_id: user.id,
    account_id: accountId,
    statement_ending_date: statementEndingDate,
    statement_balance: statementBalance,
    reconciled_balance: reconciledBalance,
  });

  await supabase
    .from("transactions")
    .update({ status: "reconciled" })
    .eq("account_id", accountId)
    .eq("user_id", user.id)
    .eq("status", "posted")
    .lte("transaction_date", statementEndingDate);

  await supabase
    .from("accounts")
    .update({ last_reconciled_at: statementEndingDate, updated_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/transactions");
}

export async function setBudgetCategoryValue(formData: FormData): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  const budgetMonthId = String(formData.get("budget_month_id") || "");
  const categoryId = String(formData.get("category_id") || "");
  const assigned = normalizeAmount(formData.get("assigned"));
  const targetAmount = normalizeAmount(formData.get("target_amount"));
  const rolloverEnabled = formData.get("rollover_enabled") === "on";

  if (!budgetMonthId || !categoryId || Number.isNaN(assigned) || Number.isNaN(targetAmount)) {
    redirect("/dashboard/budget?error=Datos+de+presupuesto+inválidos");
  }

  const { data: existing } = await supabase
    .from("budget_category_months")
    .select("id")
    .eq("budget_month_id", budgetMonthId)
    .eq("category_id", categoryId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("budget_category_months")
      .update({
        assigned,
        target_amount: targetAmount,
        rollover_enabled: rolloverEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("budget_category_months").insert({
      budget_month_id: budgetMonthId,
      category_id: categoryId,
      assigned,
      target_amount: targetAmount,
      rollover_enabled: rolloverEnabled,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/budget");
}

export async function updateProfile(formData: FormData): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  const fullName = String(formData.get("full_name") || "").trim();
  const avatarUrl = String(formData.get("avatar_url") || "").trim();
  const tagline = String(formData.get("tagline") || "").trim();

  if (!fullName) {
    redirect("/dashboard/settings?error=El+nombre+es+requerido");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      avatar_url: avatarUrl || null,
      tagline: tagline || null,
    })
    .eq("id", user.id);

  if (error) {
    redirect(`/dashboard/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

export async function changePassword(formData: FormData): Promise<void> {
  const { supabase } = await getFinanceContext();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");

  if (!password || !confirmPassword) {
    redirect("/dashboard/settings?error=Todos+los+campos+de+contraseña+son+requeridos");
  }

  if (password !== confirmPassword) {
    redirect("/dashboard/settings?error=Las+contraseñas+no+coinciden");
  }

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    redirect("/dashboard/settings?error=La+contraseña+no+cumple+los+requisitos+mínimos");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/dashboard/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/settings");
}

export async function clearAllUserDataAction(resetProfile: boolean): Promise<void> {
  const { supabase, user } = await getFinanceContext();

  await supabase.from("transactions").delete().eq("user_id", user.id);
  await supabase.from("recurring_rules").delete().eq("user_id", user.id);
  await supabase.from("budget_category_months").delete().in(
    "budget_month_id",
    (
      await supabase.from("budget_months").select("id").eq("user_id", user.id)
    ).data?.map((row: { id: string }) => row.id) ?? [],
  );
  await supabase.from("budget_months").delete().eq("user_id", user.id);
  await supabase.from("reconciliations").delete().eq("user_id", user.id);
  await supabase.from("accounts").delete().eq("user_id", user.id);
  await supabase.from("categories").delete().eq("user_id", user.id);
  await supabase.from("subscriptions").delete().eq("user_id", user.id);
  await supabase.from("incomes").delete().eq("user_id", user.id);

  if (resetProfile) {
    await supabase
      .from("profiles")
      .update({
        full_name: null,
        base_currency: "USD",
        currency: "USD",
        tagline: null,
      })
      .eq("id", user.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/subscriptions");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/budget");
  revalidatePath("/dashboard/settings");
}

export async function refreshRecurringSchedule(): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  await materializeAllRecurringRules(supabase, user.id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/subscriptions");
}
