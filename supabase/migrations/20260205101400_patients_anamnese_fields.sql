-- Campos do cadastro do paciente para reaproveitar na anamnese
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS profession TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS referred_by TEXT,
  ADD COLUMN IF NOT EXISTS consultation_objective TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

COMMENT ON COLUMN public.patients.profession IS 'Profissão do paciente';
COMMENT ON COLUMN public.patients.address IS 'Endereço';
COMMENT ON COLUMN public.patients.city IS 'Cidade';
COMMENT ON COLUMN public.patients.referred_by IS 'Indicado por';
COMMENT ON COLUMN public.patients.consultation_objective IS 'Objetivo da consulta';
COMMENT ON COLUMN public.patients.emergency_contact_name IS 'Contato de emergência - Nome';
COMMENT ON COLUMN public.patients.emergency_contact_phone IS 'Contato de emergência - Tel./Cel.';
