-- Opcional: desabilita o módulo Depilação a laser para todos os profissionais
-- (o admin pode reabilitar individualmente).
-- Rode no SQL Editor do Supabase se quiser começar com o menu fechado para todos.

UPDATE public.profiles
SET disabled_modules = CASE
  WHEN disabled_modules IS NULL THEN ARRAY['depilacao-laser']::text[]
  WHEN NOT ('depilacao-laser' = ANY (disabled_modules)) THEN array_append(disabled_modules, 'depilacao-laser')
  ELSE disabled_modules
END;
