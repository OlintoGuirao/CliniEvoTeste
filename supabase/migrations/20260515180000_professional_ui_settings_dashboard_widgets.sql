ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS show_dashboard_birthdays boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_dashboard_future_clients boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_dashboard_botox_reminders boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.professional_ui_settings.show_dashboard_birthdays IS
  'Exibe o card de aniversariantes da semana no dashboard.';
COMMENT ON COLUMN public.professional_ui_settings.show_dashboard_future_clients IS
  'Exibe o card de futuros clientes no dashboard.';
COMMENT ON COLUMN public.professional_ui_settings.show_dashboard_botox_reminders IS
  'Exibe lembretes de reaplicação de Botox no dashboard.';
