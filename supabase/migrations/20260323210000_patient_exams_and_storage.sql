-- Exames do paciente
CREATE TABLE IF NOT EXISTS public.patient_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exam_name TEXT NOT NULL,
  exam_date DATE NULL,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NULL,
  extracted_text TEXT NULL,
  ai_summary TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_exams_patient_id ON public.patient_exams(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_exams_professional_id ON public.patient_exams(professional_id);
CREATE INDEX IF NOT EXISTS idx_patient_exams_exam_date ON public.patient_exams(exam_date DESC);

DROP TRIGGER IF EXISTS update_patient_exams_updated_at ON public.patient_exams;
CREATE TRIGGER update_patient_exams_updated_at
  BEFORE UPDATE ON public.patient_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.patient_exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Professionals can manage exams of their patients" ON public.patient_exams;
CREATE POLICY "Professionals can manage exams of their patients"
  ON public.patient_exams FOR ALL
  USING (public.is_patient_owner(patient_id))
  WITH CHECK (public.is_patient_owner(patient_id));

-- Bucket de arquivos de exames
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-exams',
  'patient-exams',
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

DROP POLICY IF EXISTS "Authenticated can upload patient exams" ON storage.objects;
CREATE POLICY "Authenticated can upload patient exams"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'patient-exams'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated can update patient exams" ON storage.objects;
CREATE POLICY "Authenticated can update patient exams"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'patient-exams'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated can delete patient exams" ON storage.objects;
CREATE POLICY "Authenticated can delete patient exams"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'patient-exams'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public read patient exams" ON storage.objects;
CREATE POLICY "Public read patient exams"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'patient-exams');
