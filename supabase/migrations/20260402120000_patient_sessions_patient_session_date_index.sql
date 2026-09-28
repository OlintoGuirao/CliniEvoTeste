-- Otimiza patient_sessions filtradas por paciente + ORDER BY session_date DESC LIMIT n
-- (PostgREST: ConsultationSessionPage — últimas sessões com embed)
CREATE INDEX IF NOT EXISTS idx_patient_sessions_patient_id_session_date_desc
  ON public.patient_sessions (patient_id, session_date DESC);
