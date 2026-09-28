-- Receituário do paciente
CREATE TABLE IF NOT EXISTS public.patient_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  prescription_text TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  pdf_path TEXT NOT NULL,
  professional_name_snapshot TEXT NULL,
  patient_name_snapshot TEXT NULL,
  professional_registry_snapshot TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_patient_id ON public.patient_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_professional_id ON public.patient_prescriptions(professional_id);
CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_issued_at ON public.patient_prescriptions(issued_at DESC);

DROP TRIGGER IF EXISTS update_patient_prescriptions_updated_at ON public.patient_prescriptions;
CREATE TRIGGER update_patient_prescriptions_updated_at
  BEFORE UPDATE ON public.patient_prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.patient_prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Professionals can manage prescriptions of their patients" ON public.patient_prescriptions;
CREATE POLICY "Professionals can manage prescriptions of their patients"
  ON public.patient_prescriptions FOR ALL
  USING (public.is_patient_owner(patient_id))
  WITH CHECK (public.is_patient_owner(patient_id));
