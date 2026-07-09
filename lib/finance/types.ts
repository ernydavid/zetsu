export type AccountType =
  | "cash"
  | "checking"
  | "savings"
  | "credit_card"
  | "loan";

export type AccountOrigin = "manual" | "synced";

export type TransactionKind = "income" | "expense" | "transfer";

export type TransactionOrigin = "manual" | "synced" | "system";

export type TransactionStatus =
  | "scheduled"
  | "pending"
  | "posted"
  | "reconciled"
  | "cancelled";

export type BankProvider = "tink" | "belvo";
export type ConnectionStatus =
  | "pending"
  | "connected"
  | "attention"
  | "revoked"
  | "manual_only";
export type ConnectionMode = "sandbox" | "live" | "manual_only";
export type ExternalSyncState = "current" | "stale" | "error";
export type InstitutionAvailability = "available" | "pilot" | "manual_only";
export type DebtType =
  | "credit_card"
  | "loan"
  | "mortgage"
  | "personal"
  | "tax"
  | "other";
export type DebtStatus = "active" | "paused" | "paid" | "archived";

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
  origin: AccountOrigin;
  currency: string;
  opening_balance: number | string;
  include_in_budget: boolean;
  country_code?: string | null;
  provider?: BankProvider | null;
  external_account_id?: string | null;
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
  schedule_config?: Record<string, unknown> | null;
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
  origin: TransactionOrigin;
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
  external_transaction_id?: string | null;
  external_account_id?: string | null;
  sync_state?: "current" | "stale" | "error" | "ignored";
  pending_source_data?: Record<string, unknown> | null;
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

export interface BankInstitution {
  id: string;
  provider: BankProvider;
  country_code: "ES" | "CO";
  name: string;
  availability: InstitutionAvailability;
  capabilities: string[];
}

export interface BankConnection {
  id: string;
  user_id: string;
  provider: BankProvider;
  country_code: string;
  institution_id: string;
  institution_name: string;
  status: ConnectionStatus;
  connection_mode: ConnectionMode;
  consent_reference?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  last_synced_at?: string | null;
  last_sync_cursor?: string | null;
  visible_error?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalAccount {
  id: string;
  user_id: string;
  bank_connection_id: string;
  provider: BankProvider;
  external_id: string;
  name: string;
  type: string;
  currency: string;
  current_balance: number | string;
  available_balance?: number | string | null;
  account_mask?: string | null;
  institution_id: string;
  institution_name: string;
  account_id?: string | null;
  sync_state: ExternalSyncState;
  raw_data?: Record<string, unknown>;
}

export interface ExternalTransaction {
  id: string;
  user_id: string;
  external_account_id: string;
  provider: BankProvider;
  external_id?: string | null;
  dedupe_hash: string;
  amount: number | string;
  currency: string;
  direction: "credit" | "debit";
  status: "pending" | "posted";
  authorized_date?: string | null;
  posted_date?: string | null;
  description: string;
  merchant_name?: string | null;
  category_hint?: string | null;
  raw_data?: Record<string, unknown>;
  normalized_data?: Record<string, unknown>;
  transaction_id?: string | null;
}

export interface DebtObligation {
  id: string;
  user_id: string;
  name: string;
  debt_type: DebtType;
  currency: string;
  original_balance: number | string;
  current_balance: number | string;
  installment_count?: number | string | null;
  installment_amount?: number | string | null;
  payment_minimum: number | string;
  payment_target: number | string;
  due_day: number;
  apr?: number | string | null;
  status: DebtStatus;
  liability_account_id?: string | null;
  payment_account_id: string;
  provider?: string | null;
  external_account_id?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface DebtAllocation {
  id: string;
  user_id: string;
  debt_obligation_id: string;
  transaction_id: string;
  principal_amount: number | string;
  interest_amount: number | string;
  fee_amount: number | string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}
