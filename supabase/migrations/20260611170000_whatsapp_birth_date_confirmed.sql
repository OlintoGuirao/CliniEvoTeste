-- Paciente confirmou data de nascimento no bot (não perguntar de novo a cada saudação)

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS whatsapp_birth_date_confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.patients.whatsapp_birth_date_confirmed_at IS
  'Quando o paciente confirmou a data de nascimento via Secretária WhatsApp (1=correta ou após atualizar).';
