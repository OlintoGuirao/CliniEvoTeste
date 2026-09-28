ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS use_max_weight_reference BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.professional_ui_settings.use_max_weight_reference IS
  'Quando true, no resumo de emagrecimento o peso total usa maior peso histórico como base em vez da primeira sessão.';
