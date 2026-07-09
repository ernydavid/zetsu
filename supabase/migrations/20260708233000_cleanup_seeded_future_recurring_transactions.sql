-- Remove pre-seeded future recurring transactions so recurring rules
-- only materialize when their date actually arrives.
delete from public.transactions
where recurring_rule_id is not null
  and (
    status = 'scheduled'
    or (status = 'pending' and transaction_date > current_date)
  );
