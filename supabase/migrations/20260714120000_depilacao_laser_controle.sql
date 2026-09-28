-- Controle de Depilação a Laser: equipamentos, indisponibilidade e campos do procedimento

-- 1) Equipamentos (máquinas)
CREATE TABLE IF NOT EXISTS public.laser_equipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  model text,
  serial_number text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT laser_equipments_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_laser_equipments_professional
  ON public.laser_equipments (professional_id, is_active, updated_at DESC);

DROP TRIGGER IF EXISTS update_laser_equipments_updated_at ON public.laser_equipments;
CREATE TRIGGER update_laser_equipments_updated_at
  BEFORE UPDATE ON public.laser_equipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.laser_equipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "laser_equipments_select_own" ON public.laser_equipments;
CREATE POLICY "laser_equipments_select_own"
  ON public.laser_equipments FOR SELECT
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

DROP POLICY IF EXISTS "laser_equipments_insert_own" ON public.laser_equipments;
CREATE POLICY "laser_equipments_insert_own"
  ON public.laser_equipments FOR INSERT
  WITH CHECK (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

DROP POLICY IF EXISTS "laser_equipments_update_own" ON public.laser_equipments;
CREATE POLICY "laser_equipments_update_own"
  ON public.laser_equipments FOR UPDATE
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  )
  WITH CHECK (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

DROP POLICY IF EXISTS "laser_equipments_delete_own" ON public.laser_equipments;
CREATE POLICY "laser_equipments_delete_own"
  ON public.laser_equipments FOR DELETE
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

-- 2) Períodos de indisponibilidade (aluguel / manutenção) — bloqueiam a agenda
CREATE TABLE IF NOT EXISTS public.laser_equipment_unavailable_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.laser_equipments(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL DEFAULT 'aluguel',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT laser_equipment_unavailable_valid_range CHECK (end_date >= start_date),
  CONSTRAINT laser_equipment_unavailable_reason_check CHECK (
    reason IN ('aluguel', 'manutencao', 'outro')
  )
);

CREATE INDEX IF NOT EXISTS idx_laser_unavailable_professional_dates
  ON public.laser_equipment_unavailable_periods (professional_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_laser_unavailable_equipment
  ON public.laser_equipment_unavailable_periods (equipment_id);

DROP TRIGGER IF EXISTS update_laser_unavailable_updated_at ON public.laser_equipment_unavailable_periods;
CREATE TRIGGER update_laser_unavailable_updated_at
  BEFORE UPDATE ON public.laser_equipment_unavailable_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.laser_equipment_unavailable_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "laser_unavailable_select_own" ON public.laser_equipment_unavailable_periods;
CREATE POLICY "laser_unavailable_select_own"
  ON public.laser_equipment_unavailable_periods FOR SELECT
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

DROP POLICY IF EXISTS "laser_unavailable_insert_own" ON public.laser_equipment_unavailable_periods;
CREATE POLICY "laser_unavailable_insert_own"
  ON public.laser_equipment_unavailable_periods FOR INSERT
  WITH CHECK (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

DROP POLICY IF EXISTS "laser_unavailable_update_own" ON public.laser_equipment_unavailable_periods;
CREATE POLICY "laser_unavailable_update_own"
  ON public.laser_equipment_unavailable_periods FOR UPDATE
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  )
  WITH CHECK (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

DROP POLICY IF EXISTS "laser_unavailable_delete_own" ON public.laser_equipment_unavailable_periods;
CREATE POLICY "laser_unavailable_delete_own"
  ON public.laser_equipment_unavailable_periods FOR DELETE
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

COMMENT ON TABLE public.laser_equipments IS 'Máquinas de depilação a laser cadastradas pelo profissional.';
COMMENT ON TABLE public.laser_equipment_unavailable_periods IS
  'Períodos em que a máquina está alugada/em manutenção — a agenda bloqueia esses dias.';

-- 3) Campos do procedimento Depilação a Laser (se ainda não existirem)
WITH fields AS (
  SELECT * FROM (VALUES
    ('regiao_tratada', 'Região tratada', 'select_multi', '["Buço","Axilas","Virilha","Perna inteira","Meia perna","Braço","Costas","Abdômen","Rosto","Outro"]'::jsonb, 1),
    ('fototipo', 'Fototipo', 'select', '["I","II","III","IV","V","VI"]'::jsonb, 2),
    ('tipo_equipamento', 'Equipamento utilizado', 'text', '[]'::jsonb, 3),
    ('fluencia', 'Fluência / potência', 'text', '[]'::jsonb, 4),
    ('pulse_duration', 'Duração do pulso', 'text', '[]'::jsonb, 5),
    ('spot_size', 'Spot size', 'text', '[]'::jsonb, 6),
    ('numero_sessao', 'Número da sessão', 'number', '[]'::jsonb, 7),
    ('total_sessoes_previstas', 'Total de sessões previstas', 'number', '[]'::jsonb, 8),
    ('reacao_pele', 'Reação da pele', 'select', '["Sem reação","Eritema leve","Eritema moderado","Outro"]'::jsonb, 9),
    ('observacoes', 'Observações', 'text', '[]'::jsonb, 10),
    ('foto_antes', 'Foto antes', 'image', '[]'::jsonb, 11),
    ('foto_depois', 'Foto depois', 'image', '[]'::jsonb, 12)
  ) AS t(field_key, label, field_type, options, sort_order)
)
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, f.field_key, f.label, f.field_type, f.options, f.sort_order
FROM public.procedures p
CROSS JOIN fields f
WHERE p.slug = 'depilacao-laser' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;
