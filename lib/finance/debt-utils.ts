import type { DebtObligation } from "@/lib/finance/types";

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function asNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getDebtMonthlyCommitment(
  debt: Pick<DebtObligation, "installment_amount" | "payment_minimum">,
) {
  const installmentAmount = asNumber(debt.installment_amount);
  return installmentAmount > 0 ? installmentAmount : asNumber(debt.payment_minimum);
}

export function getDebtRemainingInstallments(
  debt: Pick<DebtObligation, "current_balance" | "installment_count" | "installment_amount">,
) {
  const currentBalance = asNumber(debt.current_balance);
  const installmentAmount = asNumber(debt.installment_amount);
  const storedCount = asNumber(debt.installment_count);

  if (currentBalance <= 0) {
    return 0;
  }

  if (installmentAmount > 0) {
    return Math.max(1, Math.ceil(currentBalance / installmentAmount));
  }

  return storedCount > 0 ? Math.round(storedCount) : null;
}

export function getDebtTypeLabel(debtType: DebtObligation["debt_type"]) {
  switch (debtType) {
    case "credit_card":
      return "tarjeta de credito";
    case "loan":
      return "prestamo";
    case "mortgage":
      return "hipoteca";
    case "personal":
      return "deuda personal";
    case "tax":
      return "impuestos";
    default:
      return "otro";
  }
}

export function computeRecommendedExtraPayment(params: {
  debt: DebtObligation;
  availableBalance: number;
  totalMinimums: number;
  activeDebtCount: number;
}) {
  const currentBalance = Number(params.debt.current_balance ?? 0);
  const minimum = getDebtMonthlyCommitment(params.debt);
  const surplus = Math.max(0, params.availableBalance - params.totalMinimums);
  const fairShare = params.activeDebtCount > 0 ? surplus / params.activeDebtCount : 0;

  return Math.min(currentBalance, minimum + fairShare);
}

export function nextDueDateFromDay(dueDay: number) {
  const now = new Date();
  const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(Math.max(dueDay, 1), 28)));
  if (due.toISOString().split("T")[0] < todayIso()) {
    due.setUTCMonth(due.getUTCMonth() + 1);
  }
  return due.toISOString().split("T")[0];
}
