-- Números que a secretária WhatsApp deve ignorar (não responder automaticamente).
ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS whatsapp_ignored_phones TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN public.professional_ui_settings.whatsapp_ignored_phones IS
  'Telefones (somente dígitos) que a secretária virtual não deve atender automaticamente.';
