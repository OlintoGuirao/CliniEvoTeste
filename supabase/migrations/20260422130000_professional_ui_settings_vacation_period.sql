ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS vacation_start_date DATE,
  ADD COLUMN IF NOT EXISTS vacation_end_date DATE,
  ADD COLUMN IF NOT EXISTS vacation_message TEXT;

COMMENT ON COLUMN public.professional_ui_settings.vacation_start_date IS
  'Data inicial do período de férias para bloqueio automático da agenda.';
COMMENT ON COLUMN public.professional_ui_settings.vacation_end_date IS
  'Data final do período de férias para bloqueio automático da agenda.';
COMMENT ON COLUMN public.professional_ui_settings.vacation_message IS
  'Mensagem opcional exibida no bloqueio de férias da agenda.';
