-- Tier Convênio na precificação de procedimentos da clínica

ALTER TABLE public.organization_procedures
  ADD COLUMN IF NOT EXISTS price_convenio numeric(12, 2);

ALTER TABLE public.organization_procedure_branch_prices
  ADD COLUMN IF NOT EXISTS price_convenio numeric(12, 2);

COMMENT ON COLUMN public.organization_procedures.price_convenio IS
  'Preço tabela Convênio (plano / convênio médico).';

COMMENT ON COLUMN public.organization_procedure_branch_prices.price_convenio IS
  'Override Convênio por filial.';
