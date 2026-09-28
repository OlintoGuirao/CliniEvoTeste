-- Lembrete 1h antes + confirmação de presença via bot

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS presence_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS presence_declined_at TIMESTAMPTZ;

COMMENT ON COLUMN public.appointments.reminder_1h_sent_at IS
  'Quando o lembrete automático de 1h foi enviado via WhatsApp';
COMMENT ON COLUMN public.appointments.presence_confirmed_at IS
  'Quando o paciente confirmou presença pelo bot após lembrete de 1h';
COMMENT ON COLUMN public.appointments.presence_declined_at IS
  'Quando o paciente indicou que precisa cancelar/reagendar após lembrete de 1h';

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS appointment_reminder_1h_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS appointment_presence_confirmation_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.professional_ui_settings.appointment_reminder_1h_enabled IS
  'Enviar lembrete automático 1h antes da consulta via WhatsApp';
COMMENT ON COLUMN public.professional_ui_settings.appointment_presence_confirmation_enabled IS
  'Pedir confirmação de presença no lembrete de 1h (respostas 1/2 no bot)';
