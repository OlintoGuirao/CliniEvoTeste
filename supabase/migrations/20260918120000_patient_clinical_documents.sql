-- Documentos clínicos do paciente (contrato, recibo da venda, etc.) — uso clínica.
CREATE TABLE IF NOT EXISTS public.patient_clinical_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dental_plan_id uuid NULL REFERENCES public.dental_treatment_plans(id) ON DELETE SET NULL,
  doc_type text NOT NULL DEFAULT 'outro'
    CHECK (doc_type IN ('contrato', 'recibo', 'outro')),
  title text NOT NULL,
  file_url text NOT NULL,
  file_path text NOT NULL,
  mime_type text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_clinical_documents_title_not_empty CHECK (length(trim(title)) >= 1)
);

CREATE INDEX IF NOT EXISTS patient_clinical_documents_patient_id_idx
  ON public.patient_clinical_documents (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS patient_clinical_documents_plan_id_idx
  ON public.patient_clinical_documents (dental_plan_id)
  WHERE dental_plan_id IS NOT NULL;

COMMENT ON TABLE public.patient_clinical_documents IS
  'Contratos, recibos e anexos da venda/plano odontológico (clínica).';

DROP TRIGGER IF EXISTS patient_clinical_documents_updated_at ON public.patient_clinical_documents;
CREATE TRIGGER patient_clinical_documents_updated_at
  BEFORE UPDATE ON public.patient_clinical_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.patient_clinical_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members manage patient clinical documents"
  ON public.patient_clinical_documents;
CREATE POLICY "Clinic members manage patient clinical documents"
  ON public.patient_clinical_documents
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

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-clinical-documents',
  'patient-clinical-documents',
  true,
  15728640,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated can upload patient clinical documents" ON storage.objects;
CREATE POLICY "Authenticated can upload patient clinical documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'patient-clinical-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated can update patient clinical documents" ON storage.objects;
CREATE POLICY "Authenticated can update patient clinical documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'patient-clinical-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated can delete patient clinical documents" ON storage.objects;
CREATE POLICY "Authenticated can delete patient clinical documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'patient-clinical-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public read patient clinical documents" ON storage.objects;
CREATE POLICY "Public read patient clinical documents"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'patient-clinical-documents');
