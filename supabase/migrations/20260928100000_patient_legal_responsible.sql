-- Menoridade e responsável legal no cadastro de pacientes (recurso de clínica).
-- Colunas ficam na tabela compartilhada, mas a UI/API só usa em account_type = clinic.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS is_minor boolean NOT NULL DEFAULT false;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS legal_responsible_name text;

COMMENT ON COLUMN public.patients.is_minor IS
  'Clínica: indica se o paciente é menor de idade (menos de 18 anos).';

COMMENT ON COLUMN public.patients.legal_responsible_name IS
  'Clínica: nome do responsável legal quando o paciente é menor de idade.';
