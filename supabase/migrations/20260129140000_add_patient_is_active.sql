-- Adiciona coluna is_active em patients (ativo/inativo)
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.patients.is_active IS 'Cliente ativo (true) ou inativo (false)';
