-- Registra quando o receituário foi enviado ao paciente (WhatsApp ou compartilhamento).
ALTER TABLE public.patient_prescriptions
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.patient_prescriptions.sent_at IS
  'Data/hora em que o receituário foi enviado ao paciente.';

-- Registros anteriores: considerar enviados na data de criação.
UPDATE public.patient_prescriptions
SET sent_at = created_at
WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_sent_at
  ON public.patient_prescriptions (sent_at DESC)
  WHERE sent_at IS NOT NULL;
