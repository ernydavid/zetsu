-- Add tagline to profiles table
alter table public.profiles add column if not exists tagline text;
