alter table public.debt_obligations
  add column if not exists installment_count integer,
  add column if not exists installment_amount numeric(12, 2);

update public.debt_obligations
set installment_amount = nullif(payment_minimum, 0)
where installment_amount is null;
