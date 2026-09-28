-- Toggle por profissional: lembrete automático 24h antes da consulta
ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS appointment_reminder_24h_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.professional_ui_settings.appointment_reminder_24h_enabled IS
  'Enviar lembrete automático 24h antes da consulta via WhatsApp (secretária)';
