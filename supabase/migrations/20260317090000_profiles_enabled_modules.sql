-- =============================================================================
-- Habilitar/desabilitar módulos por profissional (admin)
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN public.profiles.enabled_modules IS
  'Lista de módulos habilitados para o usuário (ex.: programa-botox). Array vazio = todos habilitados (default).';

