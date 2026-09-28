-- Visibilidade por profissional das seções em Configurações → Secretária WhatsApp (controlado pelo admin).

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS show_whatsapp_botox_billing_section BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_whatsapp_birthday_section BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_whatsapp_promotions_section BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_whatsapp_promotion_history_section BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.professional_ui_settings.show_whatsapp_botox_billing_section IS
  'Admin: exibe o card Cobrança — Programa de Botox na página Secretária WhatsApp.';
COMMENT ON COLUMN public.professional_ui_settings.show_whatsapp_birthday_section IS
  'Admin: exibe o card Parabéns de aniversário na página Secretária WhatsApp.';
COMMENT ON COLUMN public.professional_ui_settings.show_whatsapp_promotions_section IS
  'Admin: exibe o card Promoções automáticas na página Secretária WhatsApp.';
COMMENT ON COLUMN public.professional_ui_settings.show_whatsapp_promotion_history_section IS
  'Admin: exibe o card Últimos envios na página Secretária WhatsApp.';
