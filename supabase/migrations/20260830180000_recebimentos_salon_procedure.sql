-- Faturamento: recebimentos vinculados a procedimentos do salão (salon_procedures)
ALTER TABLE public.recebimentos
  ALTER COLUMN procedimento_id DROP NOT NULL;

ALTER TABLE public.recebimentos
  ADD COLUMN IF NOT EXISTS salon_procedure_id UUID REFERENCES public.salon_procedures(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS patient_session_id UUID REFERENCES public.patient_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.recebimentos
  DROP CONSTRAINT IF EXISTS recebimentos_procedure_or_salon_check;

ALTER TABLE public.recebimentos
  ADD CONSTRAINT recebimentos_procedure_or_salon_check
  CHECK (
    (procedimento_id IS NOT NULL AND salon_procedure_id IS NULL)
    OR (procedimento_id IS NULL AND salon_procedure_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_recebimentos_salon_procedure_id
  ON public.recebimentos (salon_procedure_id);

CREATE INDEX IF NOT EXISTS idx_recebimentos_patient_session_id
  ON public.recebimentos (patient_session_id);

COMMENT ON COLUMN public.recebimentos.salon_procedure_id IS
  'Procedimento do salão quando o recebimento não usa procedures (catálogo clínico).';

COMMENT ON COLUMN public.recebimentos.patient_session_id IS
  'Sessão de atendimento que originou o recebimento (opcional).';
