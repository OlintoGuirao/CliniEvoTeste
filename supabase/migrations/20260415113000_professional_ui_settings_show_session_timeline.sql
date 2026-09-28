ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS show_session_timeline BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.professional_ui_settings.show_session_timeline IS
  'Define se o registro de sessoes deve abrir em modo timeline no detalhe do procedimento.';
