-- Menoridade e responsável legal no cadastro de pacientes.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS is_minor boolean NOT NULL DEFAULT false;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS legal_responsible_name text;

COMMENT ON COLUMN public.patients.is_minor IS
  'Indica se o paciente é menor de idade (menos de 18 anos).';

COMMENT ON COLUMN public.patients.legal_responsible_name IS
  'Nome do responsável legal quando o paciente é menor de idade.';
