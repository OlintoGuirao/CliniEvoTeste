-- Bloqueios manuais por horário (curso, reunião, pessoal, etc.)
CREATE TABLE IF NOT EXISTS public.agenda_slot_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  block_date DATE NOT NULL,
  start_time TIME NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agenda_slot_blocks_professional_slot_unique UNIQUE (professional_id, block_date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_agenda_slot_blocks_professional_date
  ON public.agenda_slot_blocks(professional_id, block_date);

COMMENT ON TABLE public.agenda_slot_blocks IS 'Indisponibilidade manual na agenda (rótulo definido pelo profissional)';

ALTER TABLE public.agenda_slot_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional vê e gerencia seus bloqueios de agenda"
  ON public.agenda_slot_blocks
  FOR ALL
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_agenda_slot_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agenda_slot_blocks_updated_at ON public.agenda_slot_blocks;
CREATE TRIGGER agenda_slot_blocks_updated_at
  BEFORE UPDATE ON public.agenda_slot_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_agenda_slot_blocks_updated_at();
