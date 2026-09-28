-- Lembrete automático 24h antes da consulta (WhatsApp)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.appointments.reminder_24h_sent_at IS
  'Quando o lembrete automático de 24h foi enviado via WhatsApp';
