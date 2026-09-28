-- Antecedência (horas) e template do lembrete "próximo" (antes era fixo em 1h).

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS appointment_reminder_1h_hours integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS appointment_reminder_1h_message text;

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

COMMENT ON COLUMN public.professional_ui_settings.appointment_reminder_1h_hours IS
  'Horas antes da consulta para o lembrete curto (padrão 1). Janela do job: horas ± 0,5.';

COMMENT ON COLUMN public.professional_ui_settings.appointment_reminder_1h_message IS
  'Template do lembrete curto. Variáveis: {{nome}}, {{primeiro_nome}}, {{consulta}}, {{procedimento}}, {{data}}, {{horario}}, {{hora}}, {{profissional}}. Null/vazio = mensagem padrão.';
