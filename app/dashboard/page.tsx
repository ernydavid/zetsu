import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardClient } from "@/app/dashboard/dashboard-client";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorMsg = typeof params.error === "string" ? params.error : undefined;
  const upgradeMsg = typeof params.upgrade === "string" ? params.upgrade : undefined;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 2. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // If profile doesn't exist or is incomplete, redirect to onboarding
  if (!profile || !profile.full_name || !profile.currency) {
    redirect("/onboarding");
  }

  const currency = profile.currency;
  const isPro = profile.billing_tier === "pro";

  // 3. Fetch financial data
  const { data: incomes } = await supabase
    .from("incomes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  let subscriptions: any[] = [];
  if (isPro) {
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    subscriptions = subs || [];
  }

  // 4. Calculate stats
  const totalIncome = (incomes || []).reduce((acc, item) => acc + Number(item.amount), 0);
  const totalPayments = (payments || [])
    .filter((item) => item.status === "paid")
    .reduce((acc, item) => acc + Number(item.amount), 0);
  const totalSubscriptions = isPro ? subscriptions.reduce((acc, item) => acc + Number(item.amount), 0) : 0;
  const netBalance = totalIncome - totalPayments - totalSubscriptions;

  return (
    <DashboardClient
      profile={profile}
      incomes={incomes}
      payments={payments}
      subscriptions={subscriptions}
      isPro={isPro}
      currency={currency}
      totalIncome={totalIncome}
      totalPayments={totalPayments}
      totalSubscriptions={totalSubscriptions}
      netBalance={netBalance}
      errorMsg={errorMsg}
      upgradeMsg={upgradeMsg}
    />
  );
}
