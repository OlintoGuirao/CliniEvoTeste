-- Telefone no pré-cadastro para enviar WhatsApp ao agendar
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS pre_registration_phone TEXT;

COMMENT ON COLUMN public.appointments.pre_registration_phone IS 'Telefone no pré-cadastro; usado para enviar lembrete por WhatsApp ao agendar';
