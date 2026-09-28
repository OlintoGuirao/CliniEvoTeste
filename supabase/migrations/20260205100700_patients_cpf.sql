-- Adiciona coluna CPF em patients (para termos e identificação)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS cpf TEXT;

COMMENT ON COLUMN public.patients.cpf IS 'CPF do paciente (pode ser formatado ou apenas dígitos)';
