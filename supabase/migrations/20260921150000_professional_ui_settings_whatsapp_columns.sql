-- Colunas WhatsApp (templates + lembrete próximo + presença) — idempotente.
-- Corrige POST 400 PGRST204 em professional_ui_settings quando o app já envia esses campos.

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS whatsapp_message_templates jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS appointment_reminder_1h_hours integer NOT NULL DEFAULT 1;

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS appointment_reminder_1h_message text;

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS appointment_presence_confirmation_message text;

DO $$
BEGIN
  ALTER TABLE public.professional_ui_settings
    DROP CONSTRAINT IF EXISTS professional_ui_settings_appointment_reminder_1h_hours_check;
  ALTER TABLE public.professional_ui_settings
    ADD CONSTRAINT professional_ui_settings_appointment_reminder_1h_hours_check
    CHECK (appointment_reminder_1h_hours >= 1 AND appointment_reminder_1h_hours <= 24);
EXCEPTION
  WHEN others THEN NULL;
END $$;

COMMENT ON COLUMN public.professional_ui_settings.whatsapp_message_templates IS
  'Templates e liga/desliga das mensagens WhatsApp manuais.';

COMMENT ON COLUMN public.professional_ui_settings.appointment_reminder_1h_hours IS
  'Horas antes da consulta para o lembrete curto (padrão 1).';

COMMENT ON COLUMN public.professional_ui_settings.appointment_reminder_1h_message IS
  'Template do lembrete curto. Null/vazio = mensagem padrão.';

COMMENT ON COLUMN public.professional_ui_settings.appointment_presence_confirmation_message IS
  'Texto de confirmação de presença (1/2/3). Null/vazio = padrão.';
