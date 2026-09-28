ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS nickname text;

COMMENT ON COLUMN public.patients.nickname IS 'Apelido do paciente/cliente (ex.: salão).';
