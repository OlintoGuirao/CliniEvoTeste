-- Realtime: ficha do profissional atualiza quando o paciente assina a anamnese pelo link.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'patient_anamnese'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_anamnese;
  END IF;
END $$;

ALTER TABLE public.patient_anamnese REPLICA IDENTITY FULL;
