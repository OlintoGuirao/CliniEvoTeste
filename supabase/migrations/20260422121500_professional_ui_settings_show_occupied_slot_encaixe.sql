ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS show_occupied_slot_encaixe BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.professional_ui_settings.show_occupied_slot_encaixe IS
  'Controla a exibição da opção de encaixe no modal de horário ocupado da agenda.';
