create extension if not exists pgcrypto;

alter table public.accounts
  add column if not exists origin text not null default 'manual',
  add column if not exists country_code text,
  add column if not exists provider text,
  add column if not exists external_account_id text;

alter table public.accounts
  drop constraint if exists accounts_origin_check;

alter table public.accounts
  add constraint accounts_origin_check
  check (origin in ('manual', 'synced'));

create unique index if not exists idx_accounts_provider_external
  on public.accounts(user_id, provider, external_account_id)
  where external_account_id is not null;

create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  provider text not null check (provider in ('tink', 'belvo')),
  country_code text not null,
  institution_id text not null,
  institution_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'attention', 'revoked', 'manual_only')),
  connection_mode text not null default 'sandbox'
    check (connection_mode in ('sandbox', 'live', 'manual_only')),
  consent_reference text,
  access_token text,
  refresh_token text,
  last_synced_at timestamp with time zone,
  last_sync_cursor text,
  visible_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.external_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  bank_connection_id uuid references public.bank_connections on delete cascade not null,
  provider text not null check (provider in ('tink', 'belvo')),
  external_id text not null,
  name text not null,
  type text not null,
  currency text not null,
  current_balance numeric(12, 2) not null default 0,
  available_balance numeric(12, 2),
  account_mask text,
  institution_id text not null,
  institution_name text not null,
  account_id uuid references public.accounts on delete set null,
  sync_state text not null default 'current'
    check (sync_state in ('current', 'stale', 'error')),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (provider, external_id)
);

create table if not exists public.external_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  external_account_id uuid references public.external_accounts on delete cascade not null,
  provider text not null check (provider in ('tink', 'belvo')),
  external_id text,
  dedupe_hash text not null,
  amount numeric(12, 2) not null,
  currency text not null,
  direction text not null check (direction in ('credit', 'debit')),
  status text not null check (status in ('pending', 'posted')),
  authorized_date date,
  posted_date date,
  description text not null,
  merchant_name text,
  category_hint text,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  transaction_id uuid references public.transactions on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (provider, dedupe_hash)
);

alter table public.transactions
  add column if not exists origin text not null default 'manual',
  add column if not exists external_transaction_id text,
  add column if not exists external_account_id uuid references public.external_accounts on delete set null,
  add column if not exists sync_state text not null default 'current',
  add column if not exists pending_source_data jsonb not null default '{}'::jsonb;

alter table public.transactions
  drop constraint if exists transactions_source_type_check;

alter table public.transactions
  add constraint transactions_source_type_check
  check (
    source_type in (
      'manual_expense',
      'manual_income',
      'subscription_recurring',
      'income_recurring',
      'manual_transfer',
      'synced_transaction',
      'debt_payment',
      'system_adjustment'
    )
  );

alter table public.transactions
  drop constraint if exists transactions_origin_check;

alter table public.transactions
  add constraint transactions_origin_check
  check (origin in ('manual', 'synced', 'system'));

alter table public.transactions
  drop constraint if exists transactions_sync_state_check;

alter table public.transactions
  add constraint transactions_sync_state_check
  check (sync_state in ('current', 'stale', 'error', 'ignored'));

create unique index if not exists idx_transactions_provider_external
  on public.transactions(user_id, external_transaction_id)
  where external_transaction_id is not null;

create table if not exists public.debt_obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  debt_type text not null
    check (debt_type in ('credit_card', 'loan', 'mortgage', 'personal', 'tax', 'other')),
  currency text not null,
  original_balance numeric(12, 2) not null default 0,
  current_balance numeric(12, 2) not null default 0,
  payment_minimum numeric(12, 2) not null default 0,
  payment_target numeric(12, 2) not null default 0,
  due_day integer not null default 1 check (due_day between 1 and 31),
  apr numeric(8, 4),
  status text not null default 'active'
    check (status in ('active', 'paused', 'paid', 'archived')),
  liability_account_id uuid references public.accounts on delete set null,
  payment_account_id uuid references public.accounts on delete restrict not null,
  provider text,
  external_account_id text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists idx_debt_obligations_external
  on public.debt_obligations(user_id, provider, external_account_id)
  where external_account_id is not null;

create table if not exists public.debt_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  debt_obligation_id uuid references public.debt_obligations on delete cascade not null,
  transaction_id uuid references public.transactions on delete cascade not null,
  principal_amount numeric(12, 2) not null default 0,
  interest_amount numeric(12, 2) not null default 0,
  fee_amount numeric(12, 2) not null default 0,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (debt_obligation_id, transaction_id)
);

alter table public.bank_connections enable row level security;
alter table public.external_accounts enable row level security;
alter table public.external_transactions enable row level security;
alter table public.debt_obligations enable row level security;
alter table public.debt_allocations enable row level security;

create policy "Users can view own bank connections"
  on public.bank_connections for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert own bank connections"
  on public.bank_connections for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update own bank connections"
  on public.bank_connections for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete own bank connections"
  on public.bank_connections for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can view own external accounts"
  on public.external_accounts for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert own external accounts"
  on public.external_accounts for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update own external accounts"
  on public.external_accounts for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete own external accounts"
  on public.external_accounts for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can view own external transactions"
  on public.external_transactions for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert own external transactions"
  on public.external_transactions for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update own external transactions"
  on public.external_transactions for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete own external transactions"
  on public.external_transactions for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can view own debt obligations"
  on public.debt_obligations for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert own debt obligations"
  on public.debt_obligations for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update own debt obligations"
  on public.debt_obligations for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete own debt obligations"
  on public.debt_obligations for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can view own debt allocations"
  on public.debt_allocations for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert own debt allocations"
  on public.debt_allocations for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update own debt allocations"
  on public.debt_allocations for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete own debt allocations"
  on public.debt_allocations for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create index if not exists idx_bank_connections_user on public.bank_connections(user_id, status);
create index if not exists idx_external_accounts_connection on public.external_accounts(bank_connection_id);
create index if not exists idx_external_transactions_account on public.external_transactions(external_account_id, posted_date);
create index if not exists idx_debt_obligations_user on public.debt_obligations(user_id, status);
create index if not exists idx_debt_allocations_debt on public.debt_allocations(debt_obligation_id);
