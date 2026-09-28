-- Marca consultas agendadas como encaixe (horário extra na grade).
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_encaixe BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.appointments.is_encaixe IS 'Consulta em encaixe (fora da lógica usual de encaminhamento ou horário extra).';
