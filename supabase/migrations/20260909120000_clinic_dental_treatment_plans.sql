-- Planos de tratamento odontológico (somente clínica).
-- Paciente + profissional da org clinic; RLS via is_clinic_org_colleague.

CREATE TABLE IF NOT EXISTS public.dental_treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responsible_professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  plan_type text NOT NULL DEFAULT 'odontologico',
  origin text NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'authorized', 'negotiating', 'finished', 'cancelled')),
  authorization_code text NULL,
  authorized_at timestamptz NULL,
  budget_quote_id uuid NULL REFERENCES public.budget_quotes(id) ON DELETE SET NULL,
  discount_type text NULL CHECK (discount_type IS NULL OR discount_type IN ('percent', 'amount')),
  discount_value numeric(12, 2) NOT NULL DEFAULT 0,
  surcharge_type text NULL CHECK (surcharge_type IS NULL OR surcharge_type IN ('percent', 'amount')),
  surcharge_value numeric(12, 2) NOT NULL DEFAULT 0,
  payment_terms text NULL,
  commercial_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dental_treatment_plans_name_not_empty CHECK (length(trim(name)) >= 1)
);

CREATE INDEX IF NOT EXISTS dental_treatment_plans_patient_id_idx
  ON public.dental_treatment_plans (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dental_treatment_plans_professional_id_idx
  ON public.dental_treatment_plans (professional_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS dental_treatment_plans_authorization_code_uidx
  ON public.dental_treatment_plans (authorization_code)
  WHERE authorization_code IS NOT NULL;

COMMENT ON TABLE public.dental_treatment_plans IS
  'Planos de tratamento odontológico da clínica (odontograma + orçamento).';

DROP TRIGGER IF EXISTS dental_treatment_plans_updated_at ON public.dental_treatment_plans;
CREATE TRIGGER dental_treatment_plans_updated_at
  BEFORE UPDATE ON public.dental_treatment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.dental_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_plan_id uuid NOT NULL REFERENCES public.dental_treatment_plans(id) ON DELETE CASCADE,
  procedure_id uuid NULL,
  procedure_name text NOT NULL,
  specialty text NULL,
  price_table text NOT NULL DEFAULT 'particular',
  selection_type text NOT NULL DEFAULT 'individual'
    CHECK (selection_type IN ('individual', 'group', 'region')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price numeric(12, 2) NOT NULL DEFAULT 0,
  discount_type text NULL CHECK (discount_type IS NULL OR discount_type IN ('percent', 'amount')),
  discount_value numeric(12, 2) NOT NULL DEFAULT 0,
  surcharge_type text NULL CHECK (surcharge_type IS NULL OR surcharge_type IN ('percent', 'amount')),
  surcharge_value numeric(12, 2) NOT NULL DEFAULT 0,
  total_value numeric(12, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'authorized', 'rejected', 'done')),
  notes text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dental_plan_items_procedure_name_not_empty CHECK (length(trim(procedure_name)) >= 1)
);

CREATE INDEX IF NOT EXISTS dental_plan_items_plan_id_idx
  ON public.dental_plan_items (treatment_plan_id, sort_order, created_at);

COMMENT ON TABLE public.dental_plan_items IS
  'Itens/procedimentos de um plano odontológico (preço snapshot no momento da inclusão).';

DROP TRIGGER IF EXISTS dental_plan_items_updated_at ON public.dental_plan_items;
CREATE TRIGGER dental_plan_items_updated_at
  BEFORE UPDATE ON public.dental_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.dental_plan_item_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_item_id uuid NOT NULL REFERENCES public.dental_plan_items(id) ON DELETE CASCADE,
  tooth_number text NULL,
  tooth_type text NULL CHECK (tooth_type IS NULL OR tooth_type IN ('permanent', 'deciduous')),
  face text NULL
    CHECK (face IS NULL OR face IN ('M', 'D', 'V', 'L', 'P', 'O', 'I')),
  root text NULL,
  region text NULL
    CHECK (region IS NULL OR region IN ('upper_arch', 'lower_arch', 'both_arches')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dental_plan_item_locations_item_id_idx
  ON public.dental_plan_item_locations (plan_item_id);

COMMENT ON TABLE public.dental_plan_item_locations IS
  'Localizações (dente/face/raiz/região) de um item do plano odontológico.';

CREATE TABLE IF NOT EXISTS public.dental_tooth_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  tooth_number text NOT NULL,
  condition text NOT NULL
    CHECK (condition IN (
      'ausencia_coroa',
      'ausente',
      'canal',
      'deciduo',
      'incluso',
      'microdente',
      'permanente',
      'semi_incluso',
      'supranumerario'
    )),
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, tooth_number)
);

CREATE INDEX IF NOT EXISTS dental_tooth_conditions_patient_id_idx
  ON public.dental_tooth_conditions (patient_id);

COMMENT ON TABLE public.dental_tooth_conditions IS
  'Situação clínica dos dentes no prontuário do paciente (clínica).';

DROP TRIGGER IF EXISTS dental_tooth_conditions_updated_at ON public.dental_tooth_conditions;
CREATE TRIGGER dental_tooth_conditions_updated_at
  BEFORE UPDATE ON public.dental_tooth_conditions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.dental_treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_plan_item_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_tooth_conditions ENABLE ROW LEVEL SECURITY;

-- Plans
DROP POLICY IF EXISTS "Clinic members manage dental treatment plans"
  ON public.dental_treatment_plans;
CREATE POLICY "Clinic members manage dental treatment plans"
  ON public.dental_treatment_plans
  FOR ALL
  TO authenticated
  USING (
    public.is_clinic_org_colleague(professional_id)
    OR public.is_clinic_org_colleague(responsible_professional_id)
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  )
  WITH CHECK (
    public.is_clinic_org_colleague(professional_id)
    AND public.is_clinic_org_colleague(responsible_professional_id)
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  );

-- Items (via plan)
DROP POLICY IF EXISTS "Clinic members manage dental plan items"
  ON public.dental_plan_items;
CREATE POLICY "Clinic members manage dental plan items"
  ON public.dental_plan_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dental_treatment_plans tp
      WHERE tp.id = treatment_plan_id
        AND (
          public.is_clinic_org_colleague(tp.professional_id)
          OR public.is_clinic_org_colleague(tp.responsible_professional_id)
          OR EXISTS (
            SELECT 1 FROM public.patients p
            WHERE p.id = tp.patient_id
              AND public.is_clinic_org_colleague(p.professional_id)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dental_treatment_plans tp
      WHERE tp.id = treatment_plan_id
        AND public.is_clinic_org_colleague(tp.professional_id)
    )
  );

-- Locations (via item → plan)
DROP POLICY IF EXISTS "Clinic members manage dental plan item locations"
  ON public.dental_plan_item_locations;
CREATE POLICY "Clinic members manage dental plan item locations"
  ON public.dental_plan_item_locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dental_plan_items i
      JOIN public.dental_treatment_plans tp ON tp.id = i.treatment_plan_id
      WHERE i.id = plan_item_id
        AND (
          public.is_clinic_org_colleague(tp.professional_id)
          OR public.is_clinic_org_colleague(tp.responsible_professional_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.dental_plan_items i
      JOIN public.dental_treatment_plans tp ON tp.id = i.treatment_plan_id
      WHERE i.id = plan_item_id
        AND public.is_clinic_org_colleague(tp.professional_id)
    )
  );

-- Tooth conditions (via patient owner colleague)
DROP POLICY IF EXISTS "Clinic members manage dental tooth conditions"
  ON public.dental_tooth_conditions;
CREATE POLICY "Clinic members manage dental tooth conditions"
  ON public.dental_tooth_conditions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  );
