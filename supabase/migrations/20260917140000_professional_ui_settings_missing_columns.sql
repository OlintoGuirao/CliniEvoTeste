-- Colunas faltantes em produção (causavam POST 400 PGRST204 em professional_ui_settings).
-- Já existem nas migrations 20260722190000 e 20260831113000; aplicar se ainda não rodaram.

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS auto_send_budget_quote_billing BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS appointment_presence_confirmation_24h_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.branch_whatsapp_settings
  ADD COLUMN IF NOT EXISTS appointment_presence_confirmation_24h_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.professional_ui_settings.auto_send_budget_quote_billing IS
  'Se true, no dia de vencimento do orçamento envia cobrança PIX pelo WhatsApp quando houver parcela pendente.';

COMMENT ON COLUMN public.professional_ui_settings.appointment_presence_confirmation_24h_enabled IS
  'Pedir confirmação de presença no lembrete de 24h (respostas 1/2 no bot)';
