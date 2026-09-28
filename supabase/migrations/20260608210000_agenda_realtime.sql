-- Realtime na agenda: atualiza consultas/bloqueios sem F5 (WhatsApp, outras abas, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'agenda_slot_blocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_slot_blocks;
  END IF;
END $$;

-- Necessário para filtros postgres_changes (professional_id=eq....)
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.agenda_slot_blocks REPLICA IDENTITY FULL;
