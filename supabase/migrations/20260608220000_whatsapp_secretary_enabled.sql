-- Liga/desliga a secretária virtual (respostas automáticas do webhook WhatsApp)

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS whatsapp_secretary_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.professional_ui_settings.whatsapp_secretary_enabled IS
  'Quando false, o webhook não responde pacientes (atendimento manual pelo WhatsApp).';
