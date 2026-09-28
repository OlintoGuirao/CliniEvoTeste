-- Identidade visual por filial (gerenciada pelo Master)
ALTER TABLE public.organization_branches
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.organization_branches.accent_color IS
  'Cor de destaque da filial (hex). Definida pelo Master.';
COMMENT ON COLUMN public.organization_branches.logo_url IS
  'Logo da filial. Definida pelo Master.';
