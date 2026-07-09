"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  buildRecurringAnchorFromForm,
  buildRecurringScheduleConfigFromForm,
  ensureFinanceSetup,
  findCategoryByName,
  upsertRecurringRule,
} from "@/lib/finance/service";

interface OnboardingIncome {
  source: string;
  amount: number;
  frequency: "weekly" | "bi-weekly" | "monthly" | "one-time";
  day_of_month?: number;
  schedule_days?: number[];
}

interface OnboardingSubscription {
  name: string;
  amount: number;
  billing_cycle: "daily" | "weekly" | "bi-weekly" | "monthly" | "yearly";
  category: string;
  next_payment_date?: string;
}

interface OnboardingData {
  fullName: string;
  currency: string;
  incomes?: OnboardingIncome[];
  subscriptions?: OnboardingSubscription[];
  billingTier: "free" | "pro";
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

export async function submitOnboarding(data: OnboardingData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "No se pudo autenticar al usuario. Inicia sesión nuevamente." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: data.fullName,
      currency: data.currency,
      base_currency: data.currency,
      billing_tier: data.billingTier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: `Error al actualizar perfil: ${profileError.message}` };
  }

  const primaryAccount = await ensureFinanceSetup(
    supabase,
    user.id,
    data.currency,
    data.fullName,
    0,
  );

  const incomeCategory = await findCategoryByName(supabase, user.id, "ingreso", "income");

  if (data.incomes && data.incomes.length > 0) {
    try {
      for (const income of data.incomes) {
        if (income.frequency === "one-time") {
          await supabase.from("transactions").insert({
            user_id: user.id,
            account_id: primaryAccount.id,
            title: income.source,
            amount: income.amount,
            kind: "income",
            status: "posted",
            transaction_date: todayIso(),
            posted_date: todayIso(),
            category_id: incomeCategory.id,
            category: incomeCategory.name,
            source_type: "manual_income",
          });
          continue;
        }

        if (income.frequency === "bi-weekly" && new Set(income.schedule_days ?? []).size < 2) {
          return { error: "Los ingresos quincenales del onboarding deben tener dos días distintos." };
        }

        await upsertRecurringRule({
          supabase,
          userId: user.id,
          accountId: primaryAccount.id,
          categoryId: incomeCategory.id,
          kind: "income",
          name: income.source,
          amount: income.amount,
          cadence: income.frequency,
          anchorDate: buildRecurringAnchorFromForm(
            String(income.day_of_month || income.schedule_days?.[0] || 1),
            income.frequency,
            income.schedule_days,
          ),
          scheduleConfig: buildRecurringScheduleConfigFromForm(
            income.frequency,
            income.schedule_days ?? [],
          ),
        });
      }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron guardar los ingresos recurrentes del onboarding.",
      };
    }
  }

  if (data.subscriptions && data.subscriptions.length > 0) {
    try {
      for (const subscription of data.subscriptions) {
        const expenseCategory = await findCategoryByName(
          supabase,
          user.id,
          (subscription.category || "otros").toLowerCase(),
          "expense",
        );

        await upsertRecurringRule({
          supabase,
          userId: user.id,
          accountId: primaryAccount.id,
          categoryId: expenseCategory.id,
          kind: "expense",
          name: subscription.name,
          amount: subscription.amount,
          cadence: subscription.billing_cycle,
          anchorDate: subscription.next_payment_date || todayIso(),
        });
      }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron guardar las suscripciones del onboarding.",
      };
    }
  }

  return { success: true };
}
