-- Hora opcional da sessão/consulta
ALTER TABLE public.patient_sessions
  ADD COLUMN IF NOT EXISTS start_time TIME;

COMMENT ON COLUMN public.patient_sessions.start_time IS 'Hora de início da consulta (opcional)';
