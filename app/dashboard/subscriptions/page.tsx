import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SubscriptionsClient } from "./subscriptions-client";
import { buildCategoryLibrary } from "@/lib/finance/recurring";
import { getFinanceSnapshot } from "@/lib/finance/service";

type SubscriptionsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function pickSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SubscriptionsPage({
  searchParams,
}: SubscriptionsPageProps) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const resolvedSearchParams = await searchParams;

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
  const expenseCategoryLibrary = buildCategoryLibrary(
    snapshot.categories
      .filter((category) => category.kind === "expense")
      .map((category) => category.name),
  );

  return (
    <SubscriptionsClient
      profile={snapshot.profile}
      subscriptions={subscriptions}
      expenseCategoryLibrary={expenseCategoryLibrary}
      isPro={snapshot.profile.billing_tier === "pro"}
      currency={snapshot.profile.base_currency}
      errorMsg={pickSingleValue(resolvedSearchParams.error) ?? null}
      successMsg={pickSingleValue(resolvedSearchParams.success) ?? null}
    />
  );
}
