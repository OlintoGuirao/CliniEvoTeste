-- Visibilidade de seções na tela de consulta por profissional

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS show_before_after_gallery BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_next_evaluation_section BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.professional_ui_settings.show_before_after_gallery IS
  'Exibe o card Galeria Antes e Depois no formulário da consulta.';
COMMENT ON COLUMN public.professional_ui_settings.show_next_evaluation_section IS
  'Exibe o card Próxima avaliação no formulário da consulta.';
