-- Fotos vinculadas a sessões de atendimento (ex.: perfil Salão, sem procedure_instance)
CREATE TABLE public.patient_session_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_session_id UUID NOT NULL REFERENCES public.patient_sessions(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.patient_session_photos IS
  'Fotos de uma sessão de atendimento do paciente (ex.: salão, consulta sem procedimento clínico)';

CREATE INDEX idx_patient_session_photos_session_id
  ON public.patient_session_photos (patient_session_id, sort_order);

ALTER TABLE public.patient_session_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can manage patient_session_photos of their patients"
  ON public.patient_session_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_sessions ps
      WHERE ps.id = patient_session_id AND public.is_patient_owner(ps.patient_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patient_sessions ps
      WHERE ps.id = patient_session_id AND public.is_patient_owner(ps.patient_id)
    )
  );
