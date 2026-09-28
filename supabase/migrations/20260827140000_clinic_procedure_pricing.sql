-- Especialidade no tipo de procedimento + precificação por organização (clínica).
-- Solo (profissional único) não usa organization_procedures.

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS specialty text;

COMMENT ON COLUMN public.procedures.specialty IS
  'Especialidade do tipo: estetico | corporal | injetaveis | tecnologia | bem_estar | avaliacao | outros';

-- Seed a partir de category / slug existentes
UPDATE public.procedures p
SET specialty = CASE
  WHEN lower(coalesce(p.category, '')) LIKE '%injet%' THEN 'injetaveis'
  WHEN lower(coalesce(p.category, '')) LIKE '%tecnolog%' THEN 'tecnologia'
  WHEN lower(coalesce(p.category, '')) LIKE '%massot%'
    OR lower(coalesce(p.category, '')) LIKE '%bem-estar%'
    OR lower(coalesce(p.category, '')) LIKE '%bem estar%' THEN 'bem_estar'
  WHEN lower(coalesce(p.category, '')) LIKE '%avalia%'
    OR lower(coalesce(p.slug, '')) LIKE '%avaliacao%' THEN 'avaliacao'
  WHEN lower(coalesce(p.category, '')) LIKE '%corporal%' THEN 'corporal'
  WHEN lower(coalesce(p.category, '')) LIKE '%estét%'
    OR lower(coalesce(p.category, '')) LIKE '%estet%'
    OR lower(coalesce(p.category, '')) LIKE '%facial%'
    OR lower(coalesce(p.category, '')) LIKE '%capilar%'
    OR lower(coalesce(p.category, '')) LIKE '%rejuven%' THEN 'estetico'
  WHEN p.slug IN ('botox', 'preenchimento-facial', 'skinbooster', 'peim') THEN 'injetaveis'
  ELSE 'outros'
END
WHERE p.specialty IS NULL;

CREATE TABLE IF NOT EXISTS public.organization_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  price_oficial numeric(12, 2),
  price_parcerias numeric(12, 2),
  price_funcionarios numeric(12, 2),
  price_particular numeric(12, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_procedures_org_procedure_unique UNIQUE (organization_id, procedure_id)
);

CREATE INDEX IF NOT EXISTS organization_procedures_organization_id_idx
  ON public.organization_procedures (organization_id);

CREATE INDEX IF NOT EXISTS organization_procedures_procedure_id_idx
  ON public.organization_procedures (procedure_id);

COMMENT ON TABLE public.organization_procedures IS
  'Procedimentos ativados na clínica com preços (Oficial/Parcerias/Funcionários/Particular). Sem branch_id — vale para todas as filiais. Solo não usa.';

DROP TRIGGER IF EXISTS organization_procedures_updated_at ON public.organization_procedures;
CREATE TRIGGER organization_procedures_updated_at
  BEFORE UPDATE ON public.organization_procedures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_procedures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read organization procedures" ON public.organization_procedures;
CREATE POLICY "Org members can read organization procedures"
  ON public.organization_procedures
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT public.get_member_organization_ids(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clinic owners can insert organization procedures" ON public.organization_procedures;
CREATE POLICY "Clinic owners can insert organization procedures"
  ON public.organization_procedures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (
      SELECT public.get_owned_organization_ids(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clinic owners can update organization procedures" ON public.organization_procedures;
CREATE POLICY "Clinic owners can update organization procedures"
  ON public.organization_procedures
  FOR UPDATE
  TO authenticated
  USING (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (
      SELECT public.get_owned_organization_ids(auth.uid())
    )
  )
  WITH CHECK (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (
      SELECT public.get_owned_organization_ids(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clinic owners can delete organization procedures" ON public.organization_procedures;
CREATE POLICY "Clinic owners can delete organization procedures"
  ON public.organization_procedures
  FOR DELETE
  TO authenticated
  USING (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (
      SELECT public.get_owned_organization_ids(auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_procedures TO authenticated;
GRANT ALL ON public.organization_procedures TO service_role;

ALTER TABLE public.recebimentos
  ADD COLUMN IF NOT EXISTS price_tier text;

COMMENT ON COLUMN public.recebimentos.price_tier IS
  'Tipo de preço usado na clínica: oficial | parcerias | funcionarios | particular. NULL em contas solo.';
