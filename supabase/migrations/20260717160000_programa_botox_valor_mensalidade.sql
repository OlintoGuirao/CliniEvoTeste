-- Valor da mensalidade do Programa de Botox (usado na cobrança PIX automática).
ALTER TABLE public.programas_botox
  ADD COLUMN IF NOT EXISTS valor_mensalidade numeric(12, 2);

COMMENT ON COLUMN public.programas_botox.valor_mensalidade IS
  'Valor mensal do programa (R$). Usado para cobrança PIX automática dos meses pendentes.';

-- Default para programas existentes sem valor (padrão do contrato: R$ 150).
UPDATE public.programas_botox
SET valor_mensalidade = 150
WHERE valor_mensalidade IS NULL;
