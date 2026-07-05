import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { computeAvailableToBudget, computeBudgetRows } from "@/lib/finance/calculations";
import { getFinanceSnapshot } from "@/lib/finance/service";
import { BudgetClient } from "@/app/dashboard/budget/budget-client";

export default async function BudgetPage() {
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

  const profile = snapshot.profile;

  const budgetRows = computeBudgetRows({
    categories: snapshot.categories,
    budgetValues: snapshot.budgetValues,
    transactions: snapshot.transactions,
  });
  const availableToBudget = computeAvailableToBudget(
    snapshot.accounts,
    snapshot.transactions,
    budgetRows,
  );

  return (
    <BudgetClient
      profile={profile}
      budgetMonth={snapshot.budgetMonth}
      budgetRows={budgetRows}
      availableToBudget={availableToBudget}
    />
  );
}
