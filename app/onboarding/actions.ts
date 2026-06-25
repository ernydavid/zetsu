"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

interface OnboardingIncome {
  source: string;
  amount: number;
  frequency: "weekly" | "bi-weekly" | "monthly" | "one-time";
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

export async function submitOnboarding(data: OnboardingData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Get authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "No se pudo autenticar al usuario. Inicia sesión nuevamente." };
  }

  // 2. Update user profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: data.fullName,
      currency: data.currency,
      billing_tier: data.billingTier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: `Error al actualizar perfil: ${profileError.message}` };
  }

  // 3. Insert incomes if provided
  if (data.incomes && data.incomes.length > 0) {
    const incomesToInsert = data.incomes.map((inc) => ({
      user_id: user.id,
      source: inc.source,
      amount: inc.amount,
      frequency: inc.frequency,
    }));

    const { error: incomeError } = await supabase.from("incomes").insert(incomesToInsert);

    if (incomeError) {
      return { error: `Error al registrar ingresos: ${incomeError.message}` };
    }
  }

  // 4. Insert subscriptions if provided
  if (data.subscriptions && data.subscriptions.length > 0) {
    const subsToInsert = data.subscriptions.map((sub) => ({
      user_id: user.id,
      name: sub.name,
      amount: sub.amount,
      billing_cycle: sub.billing_cycle,
      category: sub.category || "entretenimiento",
      next_payment_date: sub.next_payment_date || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5).toISOString().split('T')[0],
      status: "active",
    }));

    const { error: subError } = await supabase.from("subscriptions").insert(subsToInsert);

    if (subError) {
      return { error: `Error al registrar suscripciones: ${subError.message}` };
    }
  }

  return { success: true };
}
