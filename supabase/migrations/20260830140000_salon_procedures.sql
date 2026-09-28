-- Procedimentos do salão (cadastro simples: nome + descrição).
-- Independente do catálogo global / precificação de clínica.

CREATE TABLE IF NOT EXISTS public.salon_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salon_procedures_name_not_empty CHECK (length(trim(name)) >= 2)
);

CREATE INDEX IF NOT EXISTS salon_procedures_organization_id_idx
  ON public.salon_procedures (organization_id);

CREATE INDEX IF NOT EXISTS salon_procedures_org_active_idx
  ON public.salon_procedures (organization_id, is_active);

COMMENT ON TABLE public.salon_procedures IS
  'Procedimentos cadastrados pelo Admin do salão (nome + descrição).';

DROP TRIGGER IF EXISTS salon_procedures_updated_at ON public.salon_procedures;
CREATE TRIGGER salon_procedures_updated_at
  BEFORE UPDATE ON public.salon_procedures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.salon_procedures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Salon members can read salon procedures"
  ON public.salon_procedures;
CREATE POLICY "Salon members can read salon procedures"
  ON public.salon_procedures
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND o.type = 'salon'
    )
  );

DROP POLICY IF EXISTS "Salon owners can insert salon procedures"
  ON public.salon_procedures;
CREATE POLICY "Salon owners can insert salon procedures"
  ON public.salon_procedures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role = 'owner'
        AND o.type = 'salon'
    )
  );

DROP POLICY IF EXISTS "Salon owners can update salon procedures"
  ON public.salon_procedures;
CREATE POLICY "Salon owners can update salon procedures"
  ON public.salon_procedures
  FOR UPDATE
  TO authenticated
  USING (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role = 'owner'
        AND o.type = 'salon'
    )
  )
  WITH CHECK (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role = 'owner'
        AND o.type = 'salon'
    )
  );

DROP POLICY IF EXISTS "Salon owners can delete salon procedures"
  ON public.salon_procedures;
CREATE POLICY "Salon owners can delete salon procedures"
  ON public.salon_procedures
  FOR DELETE
  TO authenticated
  USING (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role = 'owner'
        AND o.type = 'salon'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salon_procedures TO authenticated;
GRANT ALL ON public.salon_procedures TO service_role;
