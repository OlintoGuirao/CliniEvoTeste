-- =============================================================================
-- Desabilitar módulos por profissional (admin)
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disabled_modules TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN public.profiles.disabled_modules IS
  'Lista de módulos desabilitados para o usuário (ex.: programa-botox). Array vazio = nada desabilitado.';

