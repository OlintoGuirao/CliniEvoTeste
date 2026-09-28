-- Conta Salão / Cabeleireiro (enum). Funções na migration seguinte.
ALTER TYPE public.organization_type ADD VALUE IF NOT EXISTS 'salon';

COMMENT ON COLUMN public.profiles.account_type IS
  'Tipo da conta (Admin): solo | clinic | salon (cabeleireiro / Admin do salão).';
