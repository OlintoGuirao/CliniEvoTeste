-- Guarda o nome da receita/modelo usado no envio
ALTER TABLE public.patient_prescriptions
ADD COLUMN IF NOT EXISTS prescription_title_snapshot TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_title_snapshot
  ON public.patient_prescriptions(prescription_title_snapshot);
