-- Quem indicou o paciente (opcional), quando a origem é Indicação.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS referred_by_patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS patients_referred_by_patient_id_idx
  ON public.patients (referred_by_patient_id);

COMMENT ON COLUMN public.patients.referred_by_patient_id IS
  'Paciente da clínica que indicou, se a origem for Indicação e o indicador estiver cadastrado.';
