-- Tema preferido por profissional: 'light' | 'dark' | 'system'
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme text DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system'));

COMMENT ON COLUMN public.profiles.theme IS 'Preferência de tema do profissional: light, dark ou system';
