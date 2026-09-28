-- Contexto da central de atendimento (clínica): último remetente + vínculo com paciente
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS last_sender_type text
    CHECK (
      last_sender_type IS NULL
      OR last_sender_type IN ('patient', 'bot', 'professional')
    );

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS whatsapp_conversations_patient_id_idx
  ON public.whatsapp_conversations (patient_id)
  WHERE patient_id IS NOT NULL;

COMMENT ON COLUMN public.whatsapp_conversations.last_sender_type IS
  'Último remetente da conversa (para fila Aguardando você / Aguardando cliente).';

COMMENT ON COLUMN public.whatsapp_conversations.patient_id IS
  'Paciente vinculado manualmente ou por match na central de atendimento da clínica.';
