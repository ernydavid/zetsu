"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  computeRecommendedExtraPayment,
  getDebtRemainingInstallments,
  nextDueDateFromDay,
} from "@/lib/finance/debt-utils";
import {
  buildTinkReconnectSession,
  getOpenBankingProvider,
  getSupportedBankInstitutions,
  syncBankConnectionData,
} from "@/lib/finance/banking";
import {
  archiveRecurringRule,
  buildRecurringAnchorFromForm,
  buildRecurringScheduleConfigFromForm,
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

function getScheduleDaysFromForm(formData: FormData) {
  return formData
    .getAll("schedule_days")
    .map((value) => Number.parseInt(String(value || ""), 10))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(1, Math.min(31, value)));
}

function validateRecurringIncomeSchedule(cadence: string, scheduleDays: number[]) {
  if (cadence === "bi-weekly" && new Set(scheduleDays).size < 2) {
    redirect("/dashboard?error=Para+un+ingreso+quincenal+debes+elegir+dos+días+distintos");
  }
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
    origin: "manual",
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
  const { data: existing } = await supabase
    .from("transactions")
    .select("origin")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.origin === "synced") {
    redirect("/dashboard/transactions?error=Las+transacciones+sincronizadas+no+se+pueden+eliminar");
  }

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
    const scheduleDays = getScheduleDaysFromForm(formData);
    validateRecurringIncomeSchedule(cadence, scheduleDays);
    const anchorDate = buildRecurringAnchorFromForm(
      String(formData.get("day_of_month") || "1"),
      cadence,
      scheduleDays,
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
      scheduleConfig: buildRecurringScheduleConfigFromForm(cadence, scheduleDays),
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
    const scheduleDays = getScheduleDaysFromForm(formData);
    validateRecurringIncomeSchedule(cadence, scheduleDays);
    const anchorDate = buildRecurringAnchorFromForm(
      String(formData.get("day_of_month") || "1"),
      cadence,
      scheduleDays,
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
      scheduleConfig: buildRecurringScheduleConfigFromForm(cadence, scheduleDays),
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
    .select("transaction_date, origin")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!transaction) {
    redirect("/dashboard?error=Transacción+no+encontrada");
  }

  if (transaction.origin === "synced") {
    redirect("/dashboard/transactions?error=Las+transacciones+sincronizadas+no+se+pueden+marcar+manualmante");
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
    origin: "manual",
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
    origin: "manual",
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

export async function upsertBudgetPlan(formData: FormData): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  const budgetMonthId = String(formData.get("budget_month_id") || "");
  const rawItems = String(formData.get("items") || "[]");

  if (!budgetMonthId) {
    redirect("/dashboard/budget?error=Presupuesto+inválido");
  }

  let items: Array<{
    category_id: string;
    assigned: number;
    target_amount: number;
    rollover_enabled: boolean;
  }> = [];

  try {
    const parsed = JSON.parse(rawItems);
    if (Array.isArray(parsed)) {
      items = parsed;
    }
  } catch {
    redirect("/dashboard/budget?error=No+se+pudo+leer+el+plan+de+presupuesto");
  }

  if (items.length === 0) {
    redirect("/dashboard/budget?error=Debes+seleccionar+al+menos+una+categoría");
  }

  for (const item of items) {
    if (!item?.category_id) {
      continue;
    }

    const assigned = Number(item.assigned ?? 0);
    const targetAmount = Number(item.target_amount ?? 0);
    const rolloverEnabled = Boolean(item.rollover_enabled);

    const { data: existing } = await supabase
      .from("budget_category_months")
      .select("id")
      .eq("budget_month_id", budgetMonthId)
      .eq("category_id", item.category_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("budget_category_months")
        .update({
          assigned: Number.isFinite(assigned) ? assigned : 0,
          target_amount: Number.isFinite(targetAmount) ? targetAmount : 0,
          rollover_enabled: rolloverEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("budget_category_months").insert({
        budget_month_id: budgetMonthId,
        category_id: item.category_id,
        assigned: Number.isFinite(assigned) ? assigned : 0,
        target_amount: Number.isFinite(targetAmount) ? targetAmount : 0,
        rollover_enabled: rolloverEnabled,
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/budget");
}

export async function initiateBankConnection(formData: FormData): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  const institutionId = String(formData.get("institution_id") || "").trim();
  const countryCode = String(formData.get("country_code") || "").trim().toUpperCase();

  const institution = getSupportedBankInstitutions(countryCode).find((item) => item.id === institutionId);
  if (!institution) {
    redirect("/dashboard/banking?error=Institución+no+encontrada");
  }

  if (institution.availability === "manual_only") {
    await supabase.from("bank_connections").insert({
      user_id: user.id,
      provider: institution.provider,
      country_code: institution.country_code,
      institution_id: institution.id,
      institution_name: institution.name,
      status: "manual_only",
      connection_mode: "manual_only",
      visible_error: "Esta institución aún no está disponible para sincronización. Usa el flujo manual por ahora.",
      metadata: {
        availability: institution.availability,
      },
    });

    revalidatePath("/dashboard/banking");
    redirect("/dashboard/banking?error=Esta+institución+sigue+en+modo+manual+por+ahora");
  }

  const provider = getOpenBankingProvider(institution.provider);
  const linkSession = await provider.createLinkSession({
    userId: user.id,
    institution,
  });

  const created = await supabase
    .from("bank_connections")
    .insert({
      user_id: user.id,
      provider: institution.provider,
      country_code: institution.country_code,
      institution_id: institution.id,
      institution_name: institution.name,
      status: "pending",
      connection_mode: linkSession.mode,
      consent_reference: linkSession.consentReference,
      access_token: linkSession.accessToken ?? null,
      refresh_token: linkSession.refreshToken ?? null,
      metadata: linkSession.metadata ?? {},
    })
    .select("*")
    .single();

  const widgetUrl =
    typeof linkSession.metadata?.widget_url === "string" ? linkSession.metadata.widget_url : null;

  if (linkSession.mode === "live" && widgetUrl) {
    await supabase
      .from("bank_connections")
      .update({
        visible_error:
          institution.provider === "tink"
            ? "Completa la autorizacion en Tink para terminar la vinculacion."
            : "Completa la autorizacion en Belvo para terminar la vinculacion.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.data.id)
      .eq("user_id", user.id);

    redirect(widgetUrl);
  }

  const connectedSession = await provider.exchangeConsent({
    institution,
    consentReference: linkSession.consentReference,
  });

  const updated = await supabase
    .from("bank_connections")
    .update({
      status: "connected",
      connection_mode: connectedSession.mode,
      access_token: connectedSession.accessToken ?? null,
      refresh_token: connectedSession.refreshToken ?? null,
      metadata: connectedSession.metadata ?? {},
      visible_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", created.data.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  await syncBankConnectionData({
    supabase,
    userId: user.id,
    connection: updated.data,
  });

  redirect("/dashboard/banking");
}

export async function refreshBankConnection(formData: FormData): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  const connectionId = String(formData.get("connection_id") || "").trim();

  const { data: connection } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .single();

  if (!connection) {
    redirect("/dashboard/banking?error=Conexión+no+encontrada");
  }

  try {
    await syncBankConnectionData({
      supabase,
      userId: user.id,
      connection,
    });

    redirect("/dashboard/banking?notice=Sincronizacion+completada");
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo refrescar la conexion";
    redirect(`/dashboard/banking?error=${encodeURIComponent(message)}`);
  }
}

export async function disconnectBankConnection(formData: FormData): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  const connectionId = String(formData.get("connection_id") || "").trim();

  const { data: connection } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .single();

  if (!connection) {
    redirect("/dashboard/banking?error=Conexión+no+encontrada");
  }

  const provider = getOpenBankingProvider(connection.provider);
  await provider.revokeConnection({ connection });

  await supabase
    .from("bank_connections")
    .update({
      status: "revoked",
      visible_error: "Conexión desvinculada por el usuario.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/banking");
  redirect("/dashboard/banking");
}

export async function reconnectTinkConsent(formData: FormData): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  const connectionId = String(formData.get("connection_id") || "").trim();

  const { data: connection } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .eq("provider", "tink")
    .single();

  if (!connection) {
    redirect("/dashboard/banking?error=Conexión+de+Tink+no+encontrada");
  }

  try {
    const reconnectSession = await buildTinkReconnectSession({
      connection,
    });

    await supabase
      .from("bank_connections")
      .update({
        status: "pending",
        visible_error: "Tink requiere reconfirmar el consentimiento. Completa el flujo para continuar.",
        metadata: {
          ...(connection.metadata ?? {}),
          ...(reconnectSession.metadata ?? {}),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)
      .eq("user_id", user.id);

    redirect(reconnectSession.widgetUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo preparar la reconfirmacion de Tink";
    redirect(`/dashboard/banking?error=${encodeURIComponent(message)}`);
  }
}

export async function upsertDebtObligation(formData: FormData): Promise<void> {
  const { supabase, user, profile, primaryAccount } = await getFinanceContext();
  const debtId = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const debtType = String(formData.get("debt_type") || "other");
  const originalBalance = normalizeAmount(formData.get("original_balance"));
  const currentBalance = normalizeAmount(formData.get("current_balance"));
  const installmentAmount = normalizeAmount(formData.get("installment_amount"));
  const installmentCount = Number.parseInt(String(formData.get("installment_count") || ""), 10);
  const dueDay = Number.parseInt(String(formData.get("due_day") || "1"), 10);
  const apr = String(formData.get("apr") || "").trim();

  if (
    !name ||
    Number.isNaN(originalBalance) ||
    Number.isNaN(currentBalance) ||
    Number.isNaN(installmentAmount) ||
    Number.isNaN(installmentCount) ||
    installmentCount <= 0
  ) {
    redirect("/dashboard/debts?error=Datos+de+deuda+inválidos");
  }

  const normalizedInstallmentAmount = Math.max(0, installmentAmount);

  const payload = {
    user_id: user.id,
    name,
    debt_type: debtType,
    currency: profile.base_currency,
    original_balance: Math.max(0, originalBalance),
    current_balance: Math.max(0, currentBalance),
    installment_count: Math.max(1, installmentCount),
    installment_amount: normalizedInstallmentAmount,
    payment_minimum: normalizedInstallmentAmount,
    payment_target: 0,
    due_day: Math.max(1, Math.min(31, dueDay || 1)),
    apr: apr ? Number.parseFloat(apr) : null,
    status: Math.max(0, currentBalance) === 0 ? "paid" : "active",
    liability_account_id: null,
    payment_account_id: primaryAccount.id,
    metadata: {
      next_due_date: nextDueDateFromDay(Math.max(1, Math.min(31, dueDay || 1))),
    },
    updated_at: new Date().toISOString(),
  };

  if (debtId) {
    await supabase
      .from("debt_obligations")
      .update(payload)
      .eq("id", debtId)
      .eq("user_id", user.id);
  } else {
    await supabase.from("debt_obligations").insert(payload);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/budget");
}

export async function recordDebtPayment(formData: FormData): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  const debtId = String(formData.get("debt_id") || "").trim();
  const paymentAccountId = String(formData.get("payment_account_id") || "").trim();
  const amount = normalizeAmount(formData.get("amount"));
  const principalAmount = normalizeAmount(formData.get("principal_amount"));
  const interestAmount = normalizeAmount(formData.get("interest_amount"));
  const feeAmount = normalizeAmount(formData.get("fee_amount"));
  const transactionDate = String(formData.get("transaction_date") || todayIso());
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!debtId || !paymentAccountId || Number.isNaN(amount) || amount <= 0) {
    redirect("/dashboard/debts?error=Pago+de+deuda+inválido");
  }

  const { data: debt } = await supabase
    .from("debt_obligations")
    .select("*")
    .eq("id", debtId)
    .eq("user_id", user.id)
    .single();

  if (!debt) {
    redirect("/dashboard/debts?error=Deuda+no+encontrada");
  }

  const category = await findCategoryByName(supabase, user.id, "deuda", "expense");

  const paymentResult = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: paymentAccountId,
      title: `Pago deuda · ${debt.name}`,
      amount,
      kind: "expense",
      origin: "system",
      status: "posted",
      transaction_date: transactionDate,
      posted_date: transactionDate,
      category_id: category.id,
      category: category.name,
      notes,
      source_type: "debt_payment",
    })
    .select("*")
    .single();

  const principal = Number.isNaN(principalAmount) ? amount : Math.max(0, principalAmount);
  const interest = Number.isNaN(interestAmount) ? 0 : Math.max(0, interestAmount);
  const fees = Number.isNaN(feeAmount) ? 0 : Math.max(0, feeAmount);

  await supabase.from("debt_allocations").insert({
    user_id: user.id,
    debt_obligation_id: debtId,
    transaction_id: paymentResult.data.id,
    principal_amount: principal,
    interest_amount: interest,
    fee_amount: fees,
    notes,
  });

  const nextBalance = Math.max(0, Number(debt.current_balance) - principal);
  await supabase
    .from("debt_obligations")
    .update({
      current_balance: nextBalance,
      installment_count: getDebtRemainingInstallments({
        current_balance: nextBalance,
        installment_count: debt.installment_count,
        installment_amount: debt.installment_amount,
      }),
      status: nextBalance === 0 ? "paid" : debt.status,
      updated_at: new Date().toISOString(),
      metadata: {
        ...(debt.metadata ?? {}),
        next_due_date: nextDueDateFromDay(debt.due_day),
        recommended_payment: computeRecommendedExtraPayment({
          debt,
          availableBalance: 0,
          totalMinimums: 0,
          activeDebtCount: 1,
        }),
      },
    })
    .eq("id", debtId)
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/transactions");
}

export async function linkTransactionToDebt(formData: FormData): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  const redirectTo = String(formData.get("redirect_to") || "/dashboard/transactions").trim() || "/dashboard/transactions";
  const debtId = String(formData.get("debt_id") || "").trim();
  const transactionId = String(formData.get("transaction_id") || "").trim();
  const principalAmount = normalizeAmount(formData.get("principal_amount"));
  const interestAmount = normalizeAmount(formData.get("interest_amount"));
  const feeAmount = normalizeAmount(formData.get("fee_amount"));
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!debtId || !transactionId || Number.isNaN(principalAmount)) {
    redirect(`${redirectTo}?error=Vinculacion+de+deuda+invalida`);
  }

  const { data: debt } = await supabase
    .from("debt_obligations")
    .select("*")
    .eq("id", debtId)
    .eq("user_id", user.id)
    .single();

  if (!debt) {
    redirect(`${redirectTo}?error=Deuda+no+encontrada`);
  }

  const { data: existingAllocation } = await supabase
    .from("debt_allocations")
    .select("*")
    .eq("debt_obligation_id", debtId)
    .eq("transaction_id", transactionId)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    debt_obligation_id: debtId,
    transaction_id: transactionId,
    principal_amount: Math.max(0, principalAmount),
    interest_amount: Number.isNaN(interestAmount) ? 0 : Math.max(0, interestAmount),
    fee_amount: Number.isNaN(feeAmount) ? 0 : Math.max(0, feeAmount),
    notes,
    updated_at: new Date().toISOString(),
  };

  if (existingAllocation) {
    await supabase.from("debt_allocations").update(payload).eq("id", existingAllocation.id).eq("user_id", user.id);
  } else {
    await supabase.from("debt_allocations").insert(payload);
  }

  const previousPrincipal = existingAllocation ? Number(existingAllocation.principal_amount) : 0;
  const deltaPrincipal = Math.max(0, principalAmount) - previousPrincipal;
  const nextBalance = Math.max(0, Number(debt.current_balance) - deltaPrincipal);

  await supabase
    .from("debt_obligations")
    .update({
      current_balance: nextBalance,
      installment_count: getDebtRemainingInstallments({
        current_balance: nextBalance,
        installment_count: debt.installment_count,
        installment_amount: debt.installment_amount,
      }),
      status: nextBalance === 0 ? "paid" : debt.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", debtId)
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/transactions");
  redirect(redirectTo);
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
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/dashboard/settings?error=No+autorizado");
  }

  const { data: budgetMonths } = await supabase
    .from("budget_months")
    .select("id")
    .eq("user_id", user.id);

  const budgetMonthIds = (budgetMonths ?? []).map((row: { id: string }) => row.id);

  if (budgetMonthIds.length > 0) {
    await supabase.from("budget_category_months").delete().in("budget_month_id", budgetMonthIds);
  }

  await supabase.from("debt_allocations").delete().eq("user_id", user.id);
  await supabase.from("debt_obligations").delete().eq("user_id", user.id);
  await supabase.from("external_transactions").delete().eq("user_id", user.id);
  await supabase.from("external_accounts").delete().eq("user_id", user.id);
  await supabase.from("bank_connections").delete().eq("user_id", user.id);
  await supabase.from("transactions").delete().eq("user_id", user.id);
  await supabase.from("recurring_rules").delete().eq("user_id", user.id);
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
        currency: null,
        base_currency: null,
        avatar_url: null,
        tagline: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/subscriptions");
  revalidatePath("/dashboard/budget");
  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/banking");
  revalidatePath("/dashboard/settings");
}

export async function refreshRecurringSchedule(): Promise<void> {
  const { supabase, user } = await getFinanceContext();
  await materializeAllRecurringRules(supabase, user.id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/subscriptions");
}
