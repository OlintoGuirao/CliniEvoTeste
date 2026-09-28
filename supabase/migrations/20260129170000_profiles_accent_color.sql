-- Cor de destaque escolhida pelo profissional: null/default = tema padrão, ou hex '#rrggbb' ou preset (teal, blue, rose, etc.)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS accent_color text DEFAULT NULL;

COMMENT ON COLUMN public.profiles.accent_color IS 'Cor de destaque: null (padrão), hex (#0d9488) ou nome do preset (teal, blue, rose, violet, emerald, amber)';
