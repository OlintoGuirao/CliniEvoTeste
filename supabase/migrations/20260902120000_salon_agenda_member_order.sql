-- Salão: ordem e apelido dos profissionais na agenda multi-coluna.

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS agenda_label_nickname text,
  ADD COLUMN IF NOT EXISTS agenda_sort_order int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.organization_members.agenda_label_nickname IS
  'Apelido curto exibido na agenda do salão (colunas e etiquetas). Vazio = primeiro nome.';
COMMENT ON COLUMN public.organization_members.agenda_sort_order IS
  'Ordem de exibição na agenda do salão. Menor valor aparece primeiro.';
