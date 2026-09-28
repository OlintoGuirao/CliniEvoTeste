-- Template personalizado do lembrete WhatsApp 24h (null = mensagem padrão do sistema)

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS appointment_reminder_24h_message text;

COMMENT ON COLUMN public.professional_ui_settings.appointment_reminder_24h_message IS
  'Template do lembrete 24h. Variáveis: {{nome}}, {{primeiro_nome}}, {{procedimento}}, {{data}}, {{hora}}, {{profissional}}. Null/vazio = mensagem padrão.';
