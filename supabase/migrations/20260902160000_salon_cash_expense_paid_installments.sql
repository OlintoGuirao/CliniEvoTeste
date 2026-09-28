-- Status de pagamento por parcela (datas YYYY-MM-DD das parcelas marcadas como pagas).

ALTER TABLE public.salon_cash_expenses
  ADD COLUMN IF NOT EXISTS paid_installment_dates text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.salon_cash_expenses.paid_installment_dates IS
  'Datas (YYYY-MM-DD) das parcelas mensais já marcadas como pagas.';
