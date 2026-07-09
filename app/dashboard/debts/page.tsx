import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DebtsClient } from "./debts-client";
import {
  computeAvailableAfterDebtMinimums,
  computeAvailableBalance,
  computeDebtTotals,
} from "@/lib/finance/calculations";
import { getFinanceSnapshot } from "@/lib/finance/service";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DebtsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorMsg = typeof params.error === "string" ? params.error : undefined;

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

  const availableBalance = computeAvailableBalance(snapshot.accounts, snapshot.transactions);
  const availableAfterDebtMinimums = computeAvailableAfterDebtMinimums(
    snapshot.accounts,
    snapshot.transactions,
    snapshot.debtObligations,
  );
  const debtTotals = computeDebtTotals(snapshot.debtObligations);

  return (
    <DebtsClient
      profile={snapshot.profile}
      accounts={snapshot.accounts}
      debts={snapshot.debtObligations}
      availableBalance={availableBalance}
      availableAfterDebtMinimums={availableAfterDebtMinimums}
      debtTotals={debtTotals}
      errorMsg={errorMsg}
    />
  );
}
