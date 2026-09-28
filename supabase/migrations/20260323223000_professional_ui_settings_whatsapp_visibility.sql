ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS show_whatsapp_ultramsg BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.professional_ui_settings.show_whatsapp_ultramsg IS
'Controla exibição do card "WhatsApp (UltraMsg)" na tela de perfil do profissional.';
