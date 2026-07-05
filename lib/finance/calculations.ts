import {
  monthEndIso,
  monthStartIso,
  parseIsoDate,
  toIsoDate,
  todayIso,
} from "@/lib/finance/dates";
import type {
  FinanceAccount,
  FinanceBudgetCategoryMonth,
  FinanceCategory,
  FinanceTransaction,
  TransactionStatus,
} from "@/lib/finance/types";

function asNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function isRealStatus(status: TransactionStatus) {
  return status === "posted" || status === "reconciled";
}

function isProjectedStatus(status: TransactionStatus) {
  return status === "scheduled" || status === "pending";
}

function isLiability(type: FinanceAccount["type"]) {
  return type === "credit_card" || type === "loan";
}

export function transactionSignedAmount(transaction: Pick<FinanceTransaction, "kind" | "amount">) {
  const amount = asNumber(transaction.amount);
  if (transaction.kind === "income") return amount;
  if (transaction.kind === "expense") return -amount;
  return 0;
}

export function computeAccountBalance(
  account: FinanceAccount,
  transactions: FinanceTransaction[],
  statuses: TransactionStatus[] = ["posted", "reconciled"],
) {
  const allowed = new Set(statuses);
  let balance = asNumber(account.opening_balance);

  for (const tx of transactions) {
    if (!allowed.has(tx.status)) continue;

    if (tx.kind === "transfer") {
      if (tx.account_id === account.id) {
        balance -= asNumber(tx.amount);
      }
      if (tx.transfer_account_id === account.id) {
        balance += asNumber(tx.amount);
      }
      continue;
    }

    if (tx.account_id === account.id) {
      balance += transactionSignedAmount(tx);
    }
  }

  return balance;
}

export function computeNetWorth(accounts: FinanceAccount[], transactions: FinanceTransaction[]) {
  return accounts.reduce((total, account) => {
    const balance = computeAccountBalance(account, transactions);
    return total + (isLiability(account.type) ? -Math.abs(balance) : balance);
  }, 0);
}

export function computeAvailableBalance(accounts: FinanceAccount[], transactions: FinanceTransaction[]) {
  return accounts
    .filter((account) => account.include_in_budget && !isLiability(account.type))
    .reduce((total, account) => total + computeAccountBalance(account, transactions), 0);
}

export function computePeriodTotals(
  transactions: FinanceTransaction[],
  dateFrom: string,
  dateTo: string,
) {
  let income = 0;
  let expenses = 0;

  for (const tx of transactions) {
    if (!isRealStatus(tx.status)) continue;
    if (tx.transaction_date < dateFrom || tx.transaction_date > dateTo) continue;

    if (tx.kind === "income") income += asNumber(tx.amount);
    if (tx.kind === "expense") expenses += asNumber(tx.amount);
  }

  return { income, expenses };
}

export function computeUpcomingTransactions(
  transactions: FinanceTransaction[],
  horizonDays = 30,
) {
  const today = parseIsoDate(todayIso());
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + horizonDays);
  const endIso = toIsoDate(end);

  return transactions
    .filter((tx) => isProjectedStatus(tx.status))
    .filter((tx) => tx.transaction_date >= todayIso() && tx.transaction_date <= endIso)
    .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
}

export function computeProjectedCashflow(
  transactions: FinanceTransaction[],
  horizonDays = 30,
) {
  return computeUpcomingTransactions(transactions, horizonDays).reduce((total, tx) => {
    if (tx.kind === "income") return total + asNumber(tx.amount);
    if (tx.kind === "expense") return total - asNumber(tx.amount);
    return total;
  }, 0);
}

export function computeRunwayDays(availableBalance: number, monthlyExpenses: number) {
  if (availableBalance <= 0 || monthlyExpenses <= 0) {
    return null;
  }

  return Math.round((availableBalance / monthlyExpenses) * 30);
}

export function computeBudgetRows(params: {
  categories: FinanceCategory[];
  budgetValues: FinanceBudgetCategoryMonth[];
  transactions: FinanceTransaction[];
  month?: Date;
}) {
  const month = params.month ?? new Date();
  const monthStart = monthStartIso(month);
  const monthEnd = monthEndIso(month);
  const expenseCategories = params.categories.filter((category) => category.kind === "expense");

  return expenseCategories.map((category) => {
    const budgetValue = params.budgetValues.find((value) => value.category_id === category.id);
    const assigned = asNumber(budgetValue?.assigned);
    const target = asNumber(budgetValue?.target_amount);
    const rolloverEnabled = Boolean(budgetValue?.rollover_enabled ?? true);

    const activity = params.transactions
      .filter((tx) => tx.category_id === category.id)
      .filter((tx) => tx.kind === "expense" && isRealStatus(tx.status))
      .filter((tx) => tx.transaction_date >= monthStart && tx.transaction_date <= monthEnd)
      .reduce((total, tx) => total + asNumber(tx.amount), 0);

    return {
      category,
      assigned,
      target,
      activity,
      available: assigned - activity,
      rolloverEnabled,
    };
  });
}

export function computeAvailableToBudget(
  accounts: FinanceAccount[],
  transactions: FinanceTransaction[],
  budgetRows: Array<{ assigned: number }>,
) {
  const onBudgetCash = computeAvailableBalance(accounts, transactions);
  const assigned = budgetRows.reduce((total, row) => total + row.assigned, 0);
  return onBudgetCash - assigned;
}
