ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_block_id UUID NULL,
  ADD COLUMN IF NOT EXISTS is_block_start BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_appointments_block_id
  ON public.appointments(appointment_block_id)
  WHERE appointment_block_id IS NOT NULL;

COMMENT ON COLUMN public.appointments.appointment_block_id IS
  'Identificador lógico de bloco para procedimentos longos (mesma consulta em múltiplos horários).';

COMMENT ON COLUMN public.appointments.is_block_start IS
  'Marca o primeiro horário do bloco; ao desmarcar este início, todo o bloco deve ser removido.';
