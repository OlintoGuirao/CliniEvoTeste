-- Módulo de atendimento humano WhatsApp
-- Criado quando o paciente escolhe "Falar com o profissional"

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_phone text NOT NULL,
  patient_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text
);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_professional_status_idx
  ON public.whatsapp_conversations (professional_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_phone_idx
  ON public.whatsapp_conversations (professional_id, patient_phone);

COMMENT ON TABLE public.whatsapp_conversations IS
  'Conversas abertas quando paciente escolhe "Falar com o profissional" no menu WhatsApp.';

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type text NOT NULL DEFAULT 'patient'
    CHECK (sender_type IN ('patient', 'bot', 'professional')),
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  provider_message_id text
);

-- Compatibilidade se a tabela já existir sem sender_type
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS sender_type text NOT NULL DEFAULT 'patient';

CREATE INDEX IF NOT EXISTS whatsapp_messages_conversation_idx
  ON public.whatsapp_messages (conversation_id, sent_at ASC);

COMMENT ON TABLE public.whatsapp_messages IS
  'Mensagens trocadas em cada conversa de atendimento humano (patient/bot/professional).';

-- Nome exibido do bot na tela de atendimento
ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS whatsapp_bot_name text NOT NULL DEFAULT 'Secretária Virtual';

COMMENT ON COLUMN public.professional_ui_settings.whatsapp_bot_name IS
  'Nome exibido do bot na tela de Atendimento (diferencia bot do profissional).';

-- RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'whatsapp_conversations'
      AND policyname = 'professional_own_conversations'
  ) THEN
    CREATE POLICY "professional_own_conversations" ON public.whatsapp_conversations
      FOR ALL USING (professional_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'whatsapp_messages'
      AND policyname = 'professional_own_messages'
  ) THEN
    CREATE POLICY "professional_own_messages" ON public.whatsapp_messages
      FOR ALL USING (professional_id = auth.uid());
  END IF;
END $$;
