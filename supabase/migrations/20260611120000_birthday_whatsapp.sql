-- Mensagens automáticas de aniversário via WhatsApp (Evolution API)

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS birthday_whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS birthday_whatsapp_message TEXT;

COMMENT ON COLUMN public.professional_ui_settings.birthday_whatsapp_enabled IS
  'Envia mensagem de parabéns na segunda-feira da semana do aniversário via WhatsApp (Evolution API).';

COMMENT ON COLUMN public.professional_ui_settings.birthday_whatsapp_message IS
  'Template da mensagem de aniversário. Placeholders: {{nome}}, {{primeiro_nome}}, {{profissional}}.';

CREATE TABLE IF NOT EXISTS public.patient_birthday_whatsapp_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  birth_year INT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'evolution',
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS patient_birthday_whatsapp_sent_patient_year_idx
  ON public.patient_birthday_whatsapp_sent(patient_id, birth_year);

CREATE INDEX IF NOT EXISTS patient_birthday_whatsapp_sent_professional_sent_idx
  ON public.patient_birthday_whatsapp_sent(professional_id, sent_at DESC);

COMMENT ON TABLE public.patient_birthday_whatsapp_sent IS
  'Histórico de parabéns WhatsApp por aniversário (evita duplicata no mesmo ano).';

ALTER TABLE public.patient_birthday_whatsapp_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_birthday_whatsapp_sent_professional_access ON public.patient_birthday_whatsapp_sent;

CREATE POLICY patient_birthday_whatsapp_sent_professional_access
  ON public.patient_birthday_whatsapp_sent
  FOR ALL
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());
