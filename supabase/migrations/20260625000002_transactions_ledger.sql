-- 1. Add next_pay_date to incomes
alter table public.incomes add column next_pay_date date not null default current_date;

-- 2. Create transactions table
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  amount numeric(12, 2) not null,
  title text not null,
  category text not null,
  date date not null default current_date,
  status text not null default 'paid' check (status in ('paid', 'unpaid')),
  source_type text not null check (source_type in ('manual_expense', 'manual_income', 'subscription_recurring', 'income_recurring')),
  source_id uuid,
  created_at timestamp with time zone not null default now()
);

-- 3. Enable RLS on public.transactions
alter table public.transactions enable row level security;

-- 4. Create RLS policies for public.transactions
create policy "Users can view own transactions"
  on public.transactions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- 5. Copy existing payments (expenses) to transactions table
insert into public.transactions (user_id, amount, title, category, date, status, source_type, created_at)
select user_id, -amount, title, category, due_date, status, 'manual_expense', created_at
from public.payments;

-- 6. Copy existing incomes to transactions table
insert into public.transactions (user_id, amount, title, category, date, status, source_type, created_at)
select user_id, amount, source, 'ingreso', date, 'paid', 'manual_income', created_at
from public.incomes;

-- 7. Drop the old payments table
drop table public.payments;
