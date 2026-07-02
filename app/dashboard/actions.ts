"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

function calculateNextDateFromDay(dayNum: number, frequency: string = "monthly"): string {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  
  const day = Math.max(1, Math.min(31, dayNum));
  const getMaxDays = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  
  if (frequency === "bi-weekly") {
    // Semi-monthly logic: 15 days apart. Day 1 is baseDay (1-15), Day 2 is baseDay + 15.
    const baseDay = day > 15 ? day - 15 : day;
    const day1 = baseDay;
    const day2 = baseDay + 15;
    
    let y = today.getFullYear();
    let m = today.getMonth();
    let max = getMaxDays(y, m);
    
    // Check Day 1 in current month
    const d1 = new Date(Date.UTC(y, m, Math.min(day1, max)));
    const d1Str = d1.toISOString().split("T")[0];
    
    // Check Day 2 in current month
    const d2 = new Date(Date.UTC(y, m, Math.min(day2, max)));
    const d2Str = d2.toISOString().split("T")[0];
    
    if (d1Str >= todayStr) {
      return d1Str;
    }
    if (d2Str >= todayStr) {
      return d2Str;
    }
    
    // Both passed. Move to next month Day 1.
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
    max = getMaxDays(y, m);
    const dNext = new Date(Date.UTC(y, m, Math.min(day1, max)));
    return dNext.toISOString().split("T")[0];
  } else {
    // Normal monthly/weekly/daily logic
    let targetYear = today.getFullYear();
    let targetMonth = today.getMonth();
    let maxDays = getMaxDays(targetYear, targetMonth);
    let targetDay = Math.min(day, maxDays);
    let targetDate = new Date(Date.UTC(targetYear, targetMonth, targetDay));
    
    if (targetDate.toISOString().split("T")[0] < todayStr) {
      targetMonth++;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear++;
      }
      maxDays = getMaxDays(targetYear, targetMonth);
      targetDay = Math.min(day, maxDays);
      targetDate = new Date(Date.UTC(targetYear, targetMonth, targetDay));
    }
    return targetDate.toISOString().split("T")[0];
  }
}

export async function addIncome(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  const source = formData.get("source") as string;
  const amountStr = formData.get("amount") as string;
  const isRecurring = formData.get("is_recurring") === "true" || formData.get("is_recurring") === "on";

  if (!source || !amountStr) {
    redirect("/dashboard?error=Todos+los+campos+son+requeridos");
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    redirect("/dashboard?error=Monto+invalido");
  }

  if (isRecurring) {
    const frequency = (formData.get("frequency") as string) || "monthly";
    const dayStr = formData.get("day_of_month") as string;
    const nextPayDate = calculateNextDateFromDay(parseInt(dayStr || "1"), frequency);

    if (!["weekly", "bi-weekly", "monthly", "one-time"].includes(frequency)) {
      redirect("/dashboard?error=Frecuencia+de+ingreso+invalida");
    }

    const { error } = await supabase.from("incomes").insert({
      user_id: user.id,
      source,
      amount,
      frequency,
      next_pay_date: nextPayDate,
    });

    if (error) {
      redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    // One-time manual income
    const nextPayDate = (formData.get("next_pay_date") as string) || new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      title: source,
      amount: amount, // positive for income
      category: "ingreso",
      date: nextPayDate,
      status: "paid",
      source_type: "manual_income",
    });

    if (error) {
      redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
}

export async function editIncome(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  const id = formData.get("id") as string;
  const source = formData.get("source") as string;
  const amountStr = formData.get("amount") as string;
  const isRecurring = formData.get("is_recurring") === "true" || formData.get("is_recurring") === "on";

  if (!id || !source || !amountStr) {
    redirect("/dashboard?error=Todos+los+campos+son+requeridos");
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    redirect("/dashboard?error=Monto+invalido");
  }

  if (isRecurring) {
    const frequency = (formData.get("frequency") as string) || "monthly";
    const dayStr = formData.get("day_of_month") as string;
    const nextPayDate = calculateNextDateFromDay(parseInt(dayStr || "1"), frequency);

    if (!["weekly", "bi-weekly", "monthly", "one-time"].includes(frequency)) {
      redirect("/dashboard?error=Frecuencia+de+ingreso+invalida");
    }

    const { error } = await supabase
      .from("incomes")
      .update({
        source,
        amount,
        frequency,
        next_pay_date: nextPayDate,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
    }

    // Auto-synchronize current month's transactions
    const currentMonthStr = new Date().toISOString().substring(0, 7);
    await supabase
      .from("transactions")
      .update({
        title: source,
        amount: amount,
      })
      .eq("source_id", id)
      .eq("source_type", "income_recurring")
      .eq("user_id", user.id)
      .gte("date", `${currentMonthStr}-01`);
  } else {
    // Convert recurring template to a manual income transaction
    const nextPayDate = (formData.get("next_pay_date") as string) || new Date().toISOString().split("T")[0];

    // Delete the template and its generated recurring transactions
    await supabase.from("incomes").delete().eq("id", id).eq("user_id", user.id);
    await supabase.from("transactions").delete().eq("source_id", id).eq("source_type", "income_recurring").eq("user_id", user.id);

    // Insert as a single manual transaction
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      title: source,
      amount,
      category: "ingreso",
      date: nextPayDate,
      status: "paid",
      source_type: "manual_income",
    });

    if (error) {
      redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
}

export async function deleteIncome(id: string): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  // Deleting an income template also deletes its historical recurring transactions if they were generated
  await supabase
    .from("transactions")
    .delete()
    .eq("source_id", id)
    .eq("source_type", "income_recurring")
    .eq("user_id", user.id);

  const { error } = await supabase
    .from("incomes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
}

export async function addPayment(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  const title = formData.get("title") as string;
  const amountStr = formData.get("amount") as string;
  const category = (formData.get("category") as string) || "servicios";
  const isRecurring = formData.get("is_recurring") === "true" || formData.get("is_recurring") === "on";

  if (!title || !amountStr) {
    redirect("/dashboard?error=Todos+los+campos+son+requeridos");
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    redirect("/dashboard?error=Monto+invalido");
  }

  if (isRecurring) {
    // Verify Pro tier
    const { data: profile } = await supabase
      .from("profiles")
      .select("billing_tier")
      .eq("id", user.id)
      .single();

    if (profile?.billing_tier !== "pro") {
      redirect("/dashboard?error=Se+requiere+el+plan+Pro+para+gestionar+gastos+recurrentes");
    }

    const billingCycle = (formData.get("billing_cycle") as string) || "monthly";
    const dayStr = formData.get("day_of_month") as string;
    const nextPaymentDate = calculateNextDateFromDay(parseInt(dayStr || "1"), billingCycle);

    if (!["daily", "weekly", "bi-weekly", "monthly", "yearly"].includes(billingCycle)) {
      redirect("/dashboard?error=Frecuencia+de+cobro+invalida");
    }

    const { error } = await supabase.from("subscriptions").insert({
      user_id: user.id,
      name: title,
      amount,
      category,
      billing_cycle: billingCycle,
      next_payment_date: nextPaymentDate,
      status: "active",
    });

    if (error) {
      redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    // One-time manual expense
    const nextPayDate = (formData.get("next_pay_date") as string) || new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      title,
      amount: -amount,
      category,
      date: nextPayDate,
      status: "unpaid",
      source_type: "manual_expense",
    });

    if (error) {
      redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
}

export async function togglePaymentStatus(id: string, currentStatus: string): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  const newStatus = currentStatus === "paid" ? "unpaid" : "paid";

  const { error } = await supabase
    .from("transactions")
    .update({ status: newStatus })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
}

export async function deletePayment(id: string): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
}

export async function addSubscription(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  // Verify Pro tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("billing_tier")
    .eq("id", user.id)
    .single();

  if (profile?.billing_tier !== "pro") {
    redirect("/dashboard?error=Se+requiere+el+plan+Pro+para+gestionar+suscripciones");
  }

  const name = formData.get("name") as string;
  const amountStr = formData.get("amount") as string;
  const category = (formData.get("category") as string) || "entretenimiento";
  const billingCycle = (formData.get("billing_cycle") as string) || "monthly";
  const nextPaymentDate = formData.get("next_payment_date") as string;

  if (!name || !amountStr || !nextPaymentDate) {
    redirect("/dashboard?error=Todos+los+campos+son+requeridos");
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    redirect("/dashboard?error=Monto+invalido");
  }

  if (!["daily", "weekly", "bi-weekly", "monthly", "yearly"].includes(billingCycle)) {
    redirect("/dashboard?error=Frecuencia+de+cobro+invalida");
  }

  const { error } = await supabase.from("subscriptions").insert({
    user_id: user.id,
    name,
    amount,
    category,
    billing_cycle: billingCycle,
    next_payment_date: nextPaymentDate,
    status: "active",
  });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
}

export async function deleteSubscription(id: string): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  // Deleting a subscription template also deletes its historical recurring transactions if they were generated
  await supabase
    .from("transactions")
    .delete()
    .eq("source_id", id)
    .eq("source_type", "subscription_recurring")
    .eq("user_id", user.id);

  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
}

export async function editSubscription(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  // Verify Pro tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("billing_tier")
    .eq("id", user.id)
    .single();

  if (profile?.billing_tier !== "pro") {
    redirect("/dashboard?error=Se+requiere+el+plan+Pro+para+gestionar+suscripciones");
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const amountStr = formData.get("amount") as string;
  const category = (formData.get("category") as string) || "entretenimiento";
  const isRecurring = formData.get("is_recurring") === "true" || formData.get("is_recurring") === "on";

  if (!id || !name || !amountStr) {
    redirect("/dashboard?error=Todos+los+campos+son+requeridos");
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    redirect("/dashboard?error=Monto+invalido");
  }

  if (isRecurring) {
    const billingCycle = (formData.get("billing_cycle") as string) || "monthly";
    const dayStr = formData.get("day_of_month") as string;
    const nextPaymentDate = calculateNextDateFromDay(parseInt(dayStr || "1"), billingCycle);

    if (!["daily", "weekly", "bi-weekly", "monthly", "yearly"].includes(billingCycle)) {
      redirect("/dashboard?error=Frecuencia+de+cobro+invalida");
    }

    const { error } = await supabase
      .from("subscriptions")
      .update({
        name,
        amount,
        category,
        billing_cycle: billingCycle,
        next_payment_date: nextPaymentDate,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
    }

    // Auto-synchronize current month's transactions
    const currentMonthStr = new Date().toISOString().substring(0, 7);
    await supabase
      .from("transactions")
      .update({
        title: name,
        amount: -amount,
        category,
      })
      .eq("source_id", id)
      .eq("source_type", "subscription_recurring")
      .eq("user_id", user.id)
      .gte("date", `${currentMonthStr}-01`);
  } else {
    // Convert recurring template to a manual expense transaction
    const nextPayDate = (formData.get("next_pay_date") as string) || new Date().toISOString().split("T")[0];

    // Delete the template and its generated recurring transactions
    await supabase.from("subscriptions").delete().eq("id", id).eq("user_id", user.id);
    await supabase.from("transactions").delete().eq("source_id", id).eq("source_type", "subscription_recurring").eq("user_id", user.id);

    // Insert as a single manual transaction (unpaid)
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      title: name,
      amount: -amount,
      category,
      date: nextPayDate,
      status: "unpaid",
      source_type: "manual_expense",
    });

    if (error) {
      redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
}

export async function updateProfile(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  const fullName = formData.get("full_name") as string;
  const avatarUrl = formData.get("avatar_url") as string;
  const tagline = formData.get("tagline") as string;

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
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!password || !confirmPassword) {
    redirect("/dashboard/settings?error=Todos+los+campos+de+contraseña+son+requeridos");
  }

  if (password !== confirmPassword) {
    redirect("/dashboard/settings?error=Las+contraseñas+no+coinciden");
  }

  if (password.length < 6) {
    redirect("/dashboard/settings?error=La+contraseña+debe+tener+al+menos+6+caracteres");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/dashboard/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

export async function clearAllUserDataAction(resetProfile: boolean): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  // 1. Delete all user data
  await supabase.from("transactions").delete().eq("user_id", user.id);
  await supabase.from("subscriptions").delete().eq("user_id", user.id);
  await supabase.from("incomes").delete().eq("user_id", user.id);

  // 2. Reset profile if chosen
  if (resetProfile) {
    await supabase
      .from("profiles")
      .update({
        full_name: null,
        currency: null,
        tagline: null,
      })
      .eq("id", user.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/subscriptions");
  revalidatePath("/dashboard/settings");
}
