-- 1. Enable UUID Extension if not enabled
create extension if not exists "uuid-ossp";

-- 2. Create Profiles Table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone,
  full_name text,
  avatar_url text,
  billing_tier text not null default 'free' check (billing_tier in ('free', 'pro')),
  currency text not null default 'USD',
  stripe_customer_id text,
  stripe_subscription_id text
);

-- 3. Create Incomes Table
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  amount numeric(12, 2) not null check (amount >= 0),
  source text not null,
  frequency text not null default 'monthly' check (frequency in ('monthly', 'one-time', 'weekly', 'bi-weekly')),
  date date not null default current_date,
  description text,
  created_at timestamp with time zone not null default now()
);

-- 4. Create Payments Table (Free-tier manual payments/bills)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  amount numeric(12, 2) not null check (amount >= 0),
  title text not null,
  category text not null,
  due_date date not null default current_date,
  status text not null default 'unpaid' check (status in ('paid', 'unpaid', 'skipped')),
  description text,
  created_at timestamp with time zone not null default now()
);

-- 5. Create Subscriptions Table (Pro-tier recurring subscriptions)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  amount numeric(12, 2) not null check (amount >= 0),
  name text not null,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  next_payment_date date not null,
  category text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  description text,
  created_at timestamp with time zone not null default now()
);

-- 6. Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.incomes enable row level security;
alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;

-- 7. Policies for profiles
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 8. Policies for incomes
create policy "Users can view own incomes"
  on public.incomes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own incomes"
  on public.incomes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own incomes"
  on public.incomes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own incomes"
  on public.incomes for delete
  to authenticated
  using (auth.uid() = user_id);

-- 9. Policies for payments
create policy "Users can view own payments"
  on public.payments for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own payments"
  on public.payments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own payments"
  on public.payments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own payments"
  on public.payments for delete
  to authenticated
  using (auth.uid() = user_id);

-- 10. Policies for subscriptions
create policy "Users can view own subscriptions"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own subscriptions"
  on public.subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own subscriptions"
  on public.subscriptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own subscriptions"
  on public.subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

-- 11. Profile Creation Trigger on Sign Up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, billing_tier, currency)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    'free',
    'USD'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Revoke default public execution rights for trigger safety
revoke execute on function public.handle_new_user() from public;

-- Bind trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
