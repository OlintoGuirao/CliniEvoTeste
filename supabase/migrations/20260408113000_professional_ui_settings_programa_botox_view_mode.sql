ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS programa_botox_view_mode TEXT NOT NULL DEFAULT 'padrao'
  CHECK (programa_botox_view_mode IN ('padrao', 'planilha'));

COMMENT ON COLUMN public.professional_ui_settings.programa_botox_view_mode IS
  'Define layout do Programa de Botox: padrao (cards responsivos) ou planilha.';
