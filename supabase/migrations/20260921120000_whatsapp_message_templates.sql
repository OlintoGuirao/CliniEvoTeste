-- Templates editáveis das mensagens WhatsApp manuais (Confirmação, Lembrar, presença, etc.)
-- Estrutura: { [key]: { enabled: boolean, message: string | null } }
-- Null/vazio em message = texto padrão do sistema (src/lib/whatsappManualTemplates.ts).

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS whatsapp_message_templates jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.professional_ui_settings.whatsapp_message_templates IS
  'Templates e liga/desliga das mensagens WhatsApp manuais. Chaves: appointment_confirm, manual_reminder, presence_request, birthday_manual, anamnese_invite, registration_invite, budget_quote, cobranca_pix, procedure_report, session_photos.';
