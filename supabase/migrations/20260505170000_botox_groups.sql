-- Programa de Botox: suporte a múltiplos grupos por período

CREATE TABLE IF NOT EXISTS public.botox_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT botox_groups_period_check CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_botox_groups_professional_period
  ON public.botox_groups (professional_id, period_start DESC);

DROP TRIGGER IF EXISTS update_botox_groups_updated_at ON public.botox_groups;
CREATE TRIGGER update_botox_groups_updated_at
  BEFORE UPDATE ON public.botox_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.botox_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "botox_groups_select_own" ON public.botox_groups;
CREATE POLICY "botox_groups_select_own"
  ON public.botox_groups FOR SELECT
  USING (professional_id = auth.uid());

DROP POLICY IF EXISTS "botox_groups_insert_own" ON public.botox_groups;
CREATE POLICY "botox_groups_insert_own"
  ON public.botox_groups FOR INSERT
  WITH CHECK (professional_id = auth.uid());

DROP POLICY IF EXISTS "botox_groups_update_own" ON public.botox_groups;
CREATE POLICY "botox_groups_update_own"
  ON public.botox_groups FOR UPDATE
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

DROP POLICY IF EXISTS "botox_groups_delete_own" ON public.botox_groups;
CREATE POLICY "botox_groups_delete_own"
  ON public.botox_groups FOR DELETE
  USING (professional_id = auth.uid());

ALTER TABLE public.programas_botox
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.botox_groups(id) ON DELETE RESTRICT;

-- Cria grupo legado por profissional para manter compatibilidade dos registros atuais.
INSERT INTO public.botox_groups (professional_id, name, period_start, period_end)
SELECT
  pb.professional_id,
  'Grupo legado',
  COALESCE(MIN(pb.data_inicio), CURRENT_DATE),
  COALESCE(MAX(pb.data_inicio) + INTERVAL '1 year', CURRENT_DATE + INTERVAL '1 year')
FROM public.programas_botox pb
WHERE pb.group_id IS NULL
GROUP BY pb.professional_id
ON CONFLICT DO NOTHING;

UPDATE public.programas_botox pb
SET group_id = bg.id
FROM public.botox_groups bg
WHERE pb.group_id IS NULL
  AND bg.professional_id = pb.professional_id
  AND bg.name = 'Grupo legado';

ALTER TABLE public.programas_botox
  ALTER COLUMN group_id SET NOT NULL;

DROP INDEX IF EXISTS public.programas_botox_unique_active_per_patient;
CREATE UNIQUE INDEX IF NOT EXISTS programas_botox_unique_active_per_patient
  ON public.programas_botox(professional_id, paciente_id, group_id)
  WHERE status = 'ativo';

CREATE INDEX IF NOT EXISTS idx_programas_botox_group_id
  ON public.programas_botox(group_id);

