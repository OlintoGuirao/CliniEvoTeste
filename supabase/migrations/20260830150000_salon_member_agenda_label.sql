-- Cor da etiqueta do profissional (salão): usada na agenda para identificar o membro.

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS agenda_label_color text;

COMMENT ON COLUMN public.organization_members.agenda_label_color IS
  'Cor hex (#rrggbb) da etiqueta do profissional na agenda (principalmente salão).';
