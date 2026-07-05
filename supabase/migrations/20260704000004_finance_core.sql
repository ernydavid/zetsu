create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists base_currency text;

update public.profiles
set base_currency = coalesce(nullif(base_currency, ''), currency, 'USD');

alter table public.profiles
  alter column base_currency set default 'USD';

alter table public.profiles
  alter column base_currency set not null;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text not null check (type in ('cash', 'checking', 'savings', 'credit_card', 'loan')),
  currency text not null,
  opening_balance numeric(12, 2) not null default 0,
  include_in_budget boolean not null default true,
  archived_at timestamp with time zone,
  last_reconciled_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, name)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  group_name text not null default 'general',
  archived_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, name, kind)
);

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references public.accounts on delete cascade not null,
  category_id uuid references public.categories on delete set null,
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  cadence text not null check (cadence in ('daily', 'weekly', 'bi-weekly', 'monthly', 'yearly', 'one-time')),
  anchor_date date not null,
  next_occurrence date not null,
  active boolean not null default true,
  transfer_account_id uuid references public.accounts on delete set null,
  notes text,
  archived_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.budget_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  month date not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, month)
);

create table if not exists public.budget_category_months (
  id uuid primary key default gen_random_uuid(),
  budget_month_id uuid references public.budget_months on delete cascade not null,
  category_id uuid references public.categories on delete cascade not null,
  assigned numeric(12, 2) not null default 0,
  target_amount numeric(12, 2) not null default 0,
  rollover_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (budget_month_id, category_id)
);

create table if not exists public.reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references public.accounts on delete cascade not null,
  statement_ending_date date not null,
  statement_balance numeric(12, 2) not null,
  reconciled_balance numeric(12, 2) not null,
  created_at timestamp with time zone not null default now()
);

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.budget_months enable row level security;
alter table public.budget_category_months enable row level security;
alter table public.reconciliations enable row level security;

create policy "Users can view own accounts"
  on public.accounts for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert own accounts"
  on public.accounts for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update own accounts"
  on public.accounts for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete own accounts"
  on public.accounts for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can view own categories"
  on public.categories for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert own categories"
  on public.categories for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update own categories"
  on public.categories for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete own categories"
  on public.categories for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can view own recurring rules"
  on public.recurring_rules for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert own recurring rules"
  on public.recurring_rules for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update own recurring rules"
  on public.recurring_rules for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete own recurring rules"
  on public.recurring_rules for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can view own budget months"
  on public.budget_months for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert own budget months"
  on public.budget_months for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update own budget months"
  on public.budget_months for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete own budget months"
  on public.budget_months for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can view own budget category months"
  on public.budget_category_months for select
  to authenticated
  using (
    exists (
      select 1
      from public.budget_months bm
      where bm.id = budget_month_id
        and auth.uid() is not null
        and bm.user_id = auth.uid()
    )
  );

create policy "Users can insert own budget category months"
  on public.budget_category_months for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.budget_months bm
      where bm.id = budget_month_id
        and auth.uid() is not null
        and bm.user_id = auth.uid()
    )
  );

create policy "Users can update own budget category months"
  on public.budget_category_months for update
  to authenticated
  using (
    exists (
      select 1
      from public.budget_months bm
      where bm.id = budget_month_id
        and auth.uid() is not null
        and bm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.budget_months bm
      where bm.id = budget_month_id
        and auth.uid() is not null
        and bm.user_id = auth.uid()
    )
  );

create policy "Users can delete own budget category months"
  on public.budget_category_months for delete
  to authenticated
  using (
    exists (
      select 1
      from public.budget_months bm
      where bm.id = budget_month_id
        and auth.uid() is not null
        and bm.user_id = auth.uid()
    )
  );

create policy "Users can view own reconciliations"
  on public.reconciliations for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert own reconciliations"
  on public.reconciliations for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update own reconciliations"
  on public.reconciliations for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete own reconciliations"
  on public.reconciliations for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

insert into public.accounts (user_id, name, type, currency, opening_balance, include_in_budget)
select p.id, 'Cuenta principal', 'checking', p.base_currency, 0, true
from public.profiles p
where not exists (
  select 1 from public.accounts a where a.user_id = p.id
);

insert into public.categories (user_id, name, kind, group_name)
select p.id, c.name, c.kind, c.group_name
from public.profiles p
cross join (
  values
    ('ingreso', 'income', 'ingresos'),
    ('ahorro', 'expense', 'objetivos'),
    ('vivienda', 'expense', 'fijos'),
    ('servicios', 'expense', 'fijos'),
    ('comida', 'expense', 'variables'),
    ('transporte', 'expense', 'variables'),
    ('salud', 'expense', 'variables'),
    ('entretenimiento', 'expense', 'variables'),
    ('deuda', 'expense', 'finanzas'),
    ('otros', 'expense', 'variables')
) as c(name, kind, group_name)
on conflict (user_id, name, kind) do nothing;

insert into public.categories (user_id, name, kind, group_name)
select distinct t.user_id, t.category, case when t.amount >= 0 then 'income' else 'expense' end, 'migrado'
from public.transactions t
where t.category is not null
on conflict (user_id, name, kind) do nothing;

alter table public.transactions
  add column if not exists account_id uuid references public.accounts on delete restrict,
  add column if not exists kind text,
  add column if not exists transaction_date date,
  add column if not exists posted_date date,
  add column if not exists category_id uuid references public.categories on delete set null,
  add column if not exists recurring_rule_id uuid references public.recurring_rules on delete set null,
  add column if not exists transfer_account_id uuid references public.accounts on delete set null,
  add column if not exists notes text,
  add column if not exists external_id text,
  add column if not exists import_source text,
  add column if not exists authorized_date date,
  add column if not exists merchant_name text;

update public.transactions t
set account_id = a.id
from public.accounts a
where a.user_id = t.user_id
  and a.name = 'Cuenta principal'
  and t.account_id is null;

update public.transactions
set kind = case
    when source_type in ('manual_income', 'income_recurring') or amount > 0 then 'income'
    when source_type in ('manual_expense', 'subscription_recurring') or amount < 0 then 'expense'
    else 'transfer'
  end
where kind is null;

update public.transactions
set transaction_date = coalesce(transaction_date, date, created_at::date),
    authorized_date = coalesce(authorized_date, date, created_at::date)
where transaction_date is null
   or authorized_date is null;

update public.transactions
set posted_date = case
    when status = 'paid' then coalesce(date, created_at::date)
    else posted_date
  end;

update public.transactions
set amount = abs(amount);

alter table public.transactions
  drop constraint if exists transactions_status_check;

update public.transactions
set status = case
    when status = 'paid' then 'posted'
    when coalesce(transaction_date, date, current_date) > current_date then 'scheduled'
    else 'pending'
  end;

alter table public.transactions
  add constraint transactions_status_check
  check (status in ('scheduled', 'pending', 'posted', 'reconciled', 'cancelled'));

update public.transactions t
set category_id = c.id
from public.categories c
where c.user_id = t.user_id
  and c.name = t.category
  and c.kind = t.kind
  and t.category_id is null;

alter table public.transactions
  alter column account_id set not null,
  alter column kind set not null,
  alter column transaction_date set not null;

insert into public.recurring_rules (
  user_id,
  account_id,
  category_id,
  kind,
  name,
  amount,
  cadence,
  anchor_date,
  next_occurrence,
  active,
  notes
)
select
  i.user_id,
  a.id,
  c.id,
  'income',
  i.source,
  abs(i.amount),
  i.frequency,
  coalesce(i.next_pay_date, i.date, current_date),
  coalesce(i.next_pay_date, i.date, current_date),
  true,
  i.description
from public.incomes i
join public.accounts a
  on a.user_id = i.user_id
 and a.name = 'Cuenta principal'
left join public.categories c
  on c.user_id = i.user_id
 and c.name = 'ingreso'
 and c.kind = 'income'
where i.frequency <> 'one-time'
  and not exists (
    select 1
    from public.recurring_rules rr
    where rr.user_id = i.user_id
      and rr.kind = 'income'
      and rr.name = i.source
      and rr.amount = abs(i.amount)
      and rr.cadence = i.frequency
      and rr.anchor_date = coalesce(i.next_pay_date, i.date, current_date)
  );

insert into public.recurring_rules (
  user_id,
  account_id,
  category_id,
  kind,
  name,
  amount,
  cadence,
  anchor_date,
  next_occurrence,
  active,
  notes
)
select
  s.user_id,
  a.id,
  c.id,
  'expense',
  s.name,
  abs(s.amount),
  s.billing_cycle,
  s.next_payment_date,
  s.next_payment_date,
  s.status = 'active',
  s.description
from public.subscriptions s
join public.accounts a
  on a.user_id = s.user_id
 and a.name = 'Cuenta principal'
left join public.categories c
  on c.user_id = s.user_id
 and c.name = s.category
 and c.kind = 'expense'
where not exists (
  select 1
  from public.recurring_rules rr
  where rr.user_id = s.user_id
    and rr.kind = 'expense'
    and rr.name = s.name
    and rr.amount = abs(s.amount)
    and rr.cadence = s.billing_cycle
    and rr.anchor_date = s.next_payment_date
);

create index if not exists idx_accounts_user_id on public.accounts(user_id);
create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_transactions_user_status_date on public.transactions(user_id, status, transaction_date);
create index if not exists idx_transactions_account_id on public.transactions(account_id);
create index if not exists idx_transactions_recurring_rule_id on public.transactions(recurring_rule_id);
create index if not exists idx_recurring_rules_user_id on public.recurring_rules(user_id);
create index if not exists idx_budget_months_user_month on public.budget_months(user_id, month);
create index if not exists idx_reconciliations_account_id on public.reconciliations(account_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, billing_tier, currency, base_currency)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    'free',
    'USD',
    'USD'
  );
  return new;
end;
$$ language plpgsql security definer;

revoke execute on function public.handle_new_user() from public;
