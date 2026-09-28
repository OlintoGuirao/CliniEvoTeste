-- Tema de cor inteiro (como claro/escuro): 'default' ou preset (teal, blue, rose, ...)
-- Quando não é default, toda a interface usa essa cor (fundo, cards, etc.)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme_palette text DEFAULT 'default';

COMMENT ON COLUMN public.profiles.theme_palette IS 'Tema de cor inteiro: default (usa CSS) ou teal, blue, rose, violet, emerald, amber';
