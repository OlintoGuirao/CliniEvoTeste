-- Confirmação de presença opcional no lembrete automático de 24h

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS appointment_presence_confirmation_24h_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.professional_ui_settings.appointment_presence_confirmation_24h_enabled IS
  'Pedir confirmação de presença no lembrete de 24h (respostas 1/2 no bot)';

COMMENT ON COLUMN public.professional_ui_settings.appointment_presence_confirmation_enabled IS
  'Pedir confirmação de presença no lembrete de 1h (respostas 1/2 no bot)';

ALTER TABLE public.branch_whatsapp_settings
  ADD COLUMN IF NOT EXISTS appointment_presence_confirmation_24h_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.branch_whatsapp_settings.appointment_presence_confirmation_24h_enabled IS
  'Pedir confirmação de presença no lembrete de 24h (respostas 1/2 no bot)';
