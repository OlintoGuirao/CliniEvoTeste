-- Atendimentos de procedimentos autorizados do plano odontológico (somente clínica).

CREATE TABLE IF NOT EXISTS public.clinic_procedure_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid NULL REFERENCES public.appointments(id) ON DELETE SET NULL,
  treatment_plan_id uuid NULL REFERENCES public.dental_treatment_plans(id) ON DELETE SET NULL,
  plan_item_id uuid NULL REFERENCES public.dental_plan_items(id) ON DELETE SET NULL,
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'finished', 'cancelled')),
  observations text NULL,
  clinical_analysis text NULL,
  clinical_conclusion text NULL,
  signature_status text NOT NULL DEFAULT 'none'
    CHECK (signature_status IN ('none', 'pending', 'signed')),
  signature_requested_at timestamptz NULL,
  signature_signed_at timestamptz NULL,
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinic_procedure_sessions_patient_id_idx
  ON public.clinic_procedure_sessions (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS clinic_procedure_sessions_appointment_id_idx
  ON public.clinic_procedure_sessions (appointment_id)
  WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS clinic_procedure_sessions_treatment_plan_id_idx
  ON public.clinic_procedure_sessions (treatment_plan_id)
  WHERE treatment_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS clinic_procedure_sessions_plan_item_id_idx
  ON public.clinic_procedure_sessions (plan_item_id)
  WHERE plan_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS clinic_procedure_sessions_professional_id_idx
  ON public.clinic_procedure_sessions (professional_id, created_at DESC);
CREATE INDEX IF NOT EXISTS clinic_procedure_sessions_status_idx
  ON public.clinic_procedure_sessions (status);

COMMENT ON TABLE public.clinic_procedure_sessions IS
  'Sessões de atendimento clínico de itens autorizados do plano odontológico (clinic only).';

DROP TRIGGER IF EXISTS clinic_procedure_sessions_updated_at ON public.clinic_procedure_sessions;
CREATE TRIGGER clinic_procedure_sessions_updated_at
  BEFORE UPDATE ON public.clinic_procedure_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.clinic_procedure_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members manage clinic procedure sessions"
  ON public.clinic_procedure_sessions;
CREATE POLICY "Clinic members manage clinic procedure sessions"
  ON public.clinic_procedure_sessions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  );

ALTER TABLE public.patient_clinical_documents
  ADD COLUMN IF NOT EXISTS clinic_procedure_session_id uuid
    REFERENCES public.clinic_procedure_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS patient_clinical_documents_clinic_session_id_idx
  ON public.patient_clinical_documents (clinic_procedure_session_id)
  WHERE clinic_procedure_session_id IS NOT NULL;

COMMENT ON COLUMN public.patient_clinical_documents.clinic_procedure_session_id IS
  'Vínculo opcional do documento ao atendimento de procedimento autorizado (clínica).';
