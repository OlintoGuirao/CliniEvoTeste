-- Tipo de tratamento do paciente
CREATE TYPE public.patient_treatment_type AS ENUM ('weight_loss', 'botox', 'both');

ALTER TABLE public.patients
  ADD COLUMN treatment_type public.patient_treatment_type;

COMMENT ON COLUMN public.patients.treatment_type IS 'Emagrecimento, Botox/Rejuvenescimento ou Ambos';
