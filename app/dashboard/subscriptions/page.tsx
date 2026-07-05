import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SubscriptionsClient } from "./subscriptions-client";
import { getFinanceSnapshot } from "@/lib/finance/service";

export default async function SubscriptionsPage() {
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

  const subscriptions = snapshot.recurringRules
    .filter((rule) => rule.kind === "expense" && rule.active && !rule.archived_at)
    .map((rule) => ({
      id: rule.id,
      name: rule.name,
      amount: Number(rule.amount),
      billing_cycle: rule.cadence,
      next_payment_date: rule.next_occurrence,
      category: rule.category_id ? categoryMap.get(rule.category_id) ?? "otros" : "otros",
    }));

  return (
    <SubscriptionsClient
      profile={snapshot.profile}
      subscriptions={subscriptions}
      isPro={snapshot.profile.billing_tier === "pro"}
      currency={snapshot.profile.base_currency}
    />
  );
}
