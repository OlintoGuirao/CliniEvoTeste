-- Parcelas mensais em despesas do fluxo de caixa do salão.
-- Ex.: tablet em 12x → valor mensal contado por 12 meses a partir da data inicial.

ALTER TABLE public.salon_cash_expenses
  ADD COLUMN IF NOT EXISTS installment_months int NOT NULL DEFAULT 1
  CHECK (installment_months >= 1 AND installment_months <= 120);

COMMENT ON COLUMN public.salon_cash_expenses.installment_months IS
  'Quantidade de meses em que o valor se repete a partir de expense_date (ex.: 12 = 12x).';
