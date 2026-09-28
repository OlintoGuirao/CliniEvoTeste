-- Marca se o cadastro do paciente foi completado (pré-cadastro vs cadastro completo)
-- Quando null: paciente veio de pré-cadastro; ao abrir a ficha, redireciona para completar cadastro
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS registration_completed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.patients.registration_completed_at IS 'Preenchido quando o cadastro foi completado; null em pacientes criados por pré-cadastro (agendamento só com nome)';

-- Pacientes já existentes são considerados cadastro completo
UPDATE public.patients
SET registration_completed_at = created_at
WHERE registration_completed_at IS NULL;
