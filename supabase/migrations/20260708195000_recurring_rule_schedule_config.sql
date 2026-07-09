alter table public.recurring_rules
  add column if not exists schedule_config jsonb not null default '{}'::jsonb;
