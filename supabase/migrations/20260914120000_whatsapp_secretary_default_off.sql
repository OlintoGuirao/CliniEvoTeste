-- Secretária virtual: padrão desativado (profissional ativa manualmente)
ALTER TABLE public.professional_ui_settings
  ALTER COLUMN whatsapp_secretary_enabled SET DEFAULT false;

COMMENT ON COLUMN public.professional_ui_settings.whatsapp_secretary_enabled IS
  'Se true, o bot responde automaticamente no WhatsApp. Padrão: false (desativada).';

ALTER TABLE public.branch_whatsapp_settings
  ALTER COLUMN whatsapp_secretary_enabled SET DEFAULT false;
