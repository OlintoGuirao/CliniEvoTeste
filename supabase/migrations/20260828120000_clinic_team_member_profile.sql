-- Perfil profissional da equipe da clínica (conselho, especialidade, função administrativa)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS professional_specialty text;

COMMENT ON COLUMN public.profiles.professional_specialty IS
  'Especialidade do profissional (ex.: Dermatologia, Harmonização facial).';

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS staff_title text;

COMMENT ON COLUMN public.organization_members.staff_title IS
  'Função administrativa quando o membro não possui conselho de classe (ex.: secretaria, contador).';
