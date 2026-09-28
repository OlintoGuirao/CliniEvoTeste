-- Data de nascimento do profissional (ex.: preenchida em Meu perfil pela equipe clínica)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;

COMMENT ON COLUMN public.profiles.date_of_birth IS
  'Data de nascimento do profissional (perfil).';
