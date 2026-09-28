-- =============================================================================
-- Desabilitar módulo "Fluxo de caixa" para todos os profissionais
-- =============================================================================
--
-- O projeto usa `profiles.disabled_modules` para controlar módulos por usuário.
-- Este script adiciona a chave `fluxo-caixa` sem duplicar valores.
--
-- Como usar (SQL Editor Supabase):
--   1) Rode o script inteiro
--   2) Confira os SELECTs finais
-- =============================================================================

BEGIN;

UPDATE public.profiles p
SET disabled_modules = ARRAY(
  SELECT DISTINCT m
  FROM unnest(COALESCE(p.disabled_modules, ARRAY[]::text[]) || ARRAY['fluxo-caixa']) AS t(m)
)
WHERE EXISTS (
  SELECT 1
  FROM public.user_roles ur
  WHERE ur.user_id = p.id
    AND ur.role = 'professional'
);

COMMIT;

-- ---------------------------------------------------------------------------
-- Conferência rápida
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS profissionais_com_fluxo_caixa_desabilitado
FROM public.profiles p
WHERE EXISTS (
  SELECT 1
  FROM public.user_roles ur
  WHERE ur.user_id = p.id
    AND ur.role = 'professional'
)
AND COALESCE(p.disabled_modules, ARRAY[]::text[]) @> ARRAY['fluxo-caixa']::text[];

SELECT
  p.id,
  p.email,
  p.full_name,
  p.disabled_modules
FROM public.profiles p
WHERE EXISTS (
  SELECT 1
  FROM public.user_roles ur
  WHERE ur.user_id = p.id
    AND ur.role = 'professional'
)
AND COALESCE(p.disabled_modules, ARRAY[]::text[]) @> ARRAY['fluxo-caixa']::text[]
ORDER BY p.full_name NULLS LAST, p.email;
