"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function addIncome(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  const source = formData.get("source") as string;
  const amountStr = formData.get("amount") as string;
  const frequency = (formData.get("frequency") as string) || "monthly";

  if (!source || !amountStr) {
    redirect("/dashboard?error=Todos+los+campos+son+requeridos");
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    redirect("/dashboard?error=Monto+invalido");
  }

  if (!["weekly", "bi-weekly", "monthly", "one-time"].includes(frequency)) {
    redirect("/dashboard?error=Frecuencia+de+ingreso+invalida");
  }

  const { error } = await supabase.from("incomes").insert({
    user_id: user.id,
    source,
    amount,
    frequency,
  });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
}

export async function deleteIncome(id: string): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  const { error } = await supabase
    .from("incomes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
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

  if (!title || !amountStr) {
    redirect("/dashboard?error=Todos+los+campos+son+requeridos");
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    redirect("/dashboard?error=Monto+invalido");
  }

  const { error } = await supabase.from("payments").insert({
    user_id: user.id,
    title,
    amount,
    category,
    status: "unpaid",
  });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
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
    .from("payments")
    .update({ status: newStatus })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
}

export async function deletePayment(id: string): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/dashboard?error=No+autorizado");
  }

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
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
  const billingCycle = (formData.get("billing_cycle") as string) || "monthly";
  const nextPaymentDate = formData.get("next_payment_date") as string;

  if (!id || !name || !amountStr || !nextPaymentDate) {
    redirect("/dashboard?error=Todos+los+campos+son+requeridos");
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    redirect("/dashboard?error=Monto+invalido");
  }

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

  revalidatePath("/dashboard");
}
