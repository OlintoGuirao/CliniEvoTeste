-- Template editável do bloco de confirmação de presença (1/2) nos lembretes.

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS appointment_presence_confirmation_message text;

COMMENT ON COLUMN public.professional_ui_settings.appointment_presence_confirmation_message IS
  'Texto acrescentado ao lembrete quando confirmação de presença está ativa. Null/vazio = padrão com opções *1* e *2*.';
