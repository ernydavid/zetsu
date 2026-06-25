-- Expand subscriptions billing_cycle check constraint to support daily, weekly, bi-weekly, monthly, yearly
alter table public.subscriptions drop constraint if exists subscriptions_billing_cycle_check;
alter table public.subscriptions add constraint subscriptions_billing_cycle_check check (billing_cycle in ('daily', 'weekly', 'bi-weekly', 'monthly', 'yearly'));
