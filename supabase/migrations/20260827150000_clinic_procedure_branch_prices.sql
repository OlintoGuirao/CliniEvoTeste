-- Overrides de preço por filial (opcional).
-- organization_procedures continua sendo o preço padrão (todas as filiais).
-- Se existir linha em organization_procedure_branch_prices, ela prevalece naquela unidade.

CREATE TABLE IF NOT EXISTS public.organization_procedure_branch_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.organization_branches(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  price_oficial numeric(12, 2),
  price_parcerias numeric(12, 2),
  price_funcionarios numeric(12, 2),
  price_particular numeric(12, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_procedure_branch_prices_unique UNIQUE (branch_id, procedure_id)
);

CREATE INDEX IF NOT EXISTS organization_procedure_branch_prices_org_idx
  ON public.organization_procedure_branch_prices (organization_id);

CREATE INDEX IF NOT EXISTS organization_procedure_branch_prices_procedure_idx
  ON public.organization_procedure_branch_prices (procedure_id);

COMMENT ON TABLE public.organization_procedure_branch_prices IS
  'Preços por filial para um procedimento. Se ausente, usa organization_procedures (padrão da clínica).';

DROP TRIGGER IF EXISTS organization_procedure_branch_prices_updated_at
  ON public.organization_procedure_branch_prices;
CREATE TRIGGER organization_procedure_branch_prices_updated_at
  BEFORE UPDATE ON public.organization_procedure_branch_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_procedure_branch_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read branch procedure prices"
  ON public.organization_procedure_branch_prices;
CREATE POLICY "Org members can read branch procedure prices"
  ON public.organization_procedure_branch_prices
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT public.get_member_organization_ids(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clinic owners can insert branch procedure prices"
  ON public.organization_procedure_branch_prices;
CREATE POLICY "Clinic owners can insert branch procedure prices"
  ON public.organization_procedure_branch_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (
      SELECT public.get_owned_organization_ids(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clinic owners can update branch procedure prices"
  ON public.organization_procedure_branch_prices;
CREATE POLICY "Clinic owners can update branch procedure prices"
  ON public.organization_procedure_branch_prices
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

DROP POLICY IF EXISTS "Clinic owners can delete branch procedure prices"
  ON public.organization_procedure_branch_prices;
CREATE POLICY "Clinic owners can delete branch procedure prices"
  ON public.organization_procedure_branch_prices
  FOR DELETE
  TO authenticated
  USING (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (
      SELECT public.get_owned_organization_ids(auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_procedure_branch_prices TO authenticated;
GRANT ALL ON public.organization_procedure_branch_prices TO service_role;
