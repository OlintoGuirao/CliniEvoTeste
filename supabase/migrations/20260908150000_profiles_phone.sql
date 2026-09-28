-- Telefone do profissional (Meu perfil / equipe clínica)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.profiles.phone IS
  'Telefone do profissional (apenas dígitos, DDD + número).';
