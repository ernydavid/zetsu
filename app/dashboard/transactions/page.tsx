import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { TransactionsClient } from "./transactions-client";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
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

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  let subscriptions: any[] = [];
  if (isPro) {
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    subscriptions = subs || [];
  }

  return (
    <TransactionsClient
      profile={profile}
      incomes={incomes || []}
      payments={transactions || []}
      subscriptions={subscriptions}
      isPro={isPro}
      currency={currency}
    />
  );
}
