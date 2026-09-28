-- Cor dos bloqueios manuais na agenda (pin / compromisso).

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS agenda_slot_block_color text;

COMMENT ON COLUMN public.professional_ui_settings.agenda_slot_block_color IS
  'Cor Hex dos bloqueios manuais na agenda (ex.: #475569). Null = cinza padrão do tema.';
