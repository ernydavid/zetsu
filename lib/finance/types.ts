export type AccountType =
  | "cash"
  | "checking"
  | "savings"
  | "credit_card"
  | "loan";

export type TransactionKind = "income" | "expense" | "transfer";

export type TransactionStatus =
  | "scheduled"
  | "pending"
  | "posted"
  | "reconciled"
  | "cancelled";

export type RecurringCadence =
  | "daily"
  | "weekly"
  | "bi-weekly"
  | "monthly"
  | "yearly"
  | "one-time";

export interface FinanceProfile {
  id: string;
  full_name: string | null;
  billing_tier: "free" | "pro";
  base_currency: string;
  tagline?: string | null;
  avatar_url?: string | null;
}

export interface FinanceAccount {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  opening_balance: number | string;
  include_in_budget: boolean;
  archived_at?: string | null;
  last_reconciled_at?: string | null;
}

export interface FinanceCategory {
  id: string;
  user_id: string;
  name: string;
  kind: Exclude<TransactionKind, "transfer">;
  group_name: string;
  archived_at?: string | null;
}

export interface FinanceRecurringRule {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  kind: TransactionKind;
  name: string;
  amount: number | string;
  cadence: RecurringCadence;
  anchor_date: string;
  next_occurrence: string;
  active: boolean;
  transfer_account_id?: string | null;
  notes?: string | null;
  archived_at?: string | null;
}

export interface FinanceTransaction {
  id: string;
  user_id: string;
  account_id: string;
  amount: number | string;
  kind: TransactionKind;
  status: TransactionStatus;
  transaction_date: string;
  posted_date?: string | null;
  category_id?: string | null;
  recurring_rule_id?: string | null;
  transfer_account_id?: string | null;
  title: string;
  category?: string | null;
  notes?: string | null;
  merchant_name?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  created_at?: string;
}

export interface FinanceBudgetMonth {
  id: string;
  user_id: string;
  month: string;
}

export interface FinanceBudgetCategoryMonth {
  id: string;
  budget_month_id: string;
  category_id: string;
  assigned: number | string;
  target_amount: number | string;
  rollover_enabled: boolean;
}

export interface FinanceReconciliation {
  id: string;
  user_id: string;
  account_id: string;
  statement_ending_date: string;
  statement_balance: number | string;
  reconciled_balance: number | string;
  created_at: string;
}
