-- Origens de paciente cadastradas pelo master da clínica.
-- Equipe da clínica só lê; o atendente escolhe no cadastro do paciente.

CREATE TABLE IF NOT EXISTS public.clinic_patient_origins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_patient_origins_name_not_empty CHECK (length(trim(name)) >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS clinic_patient_origins_org_name_idx
  ON public.clinic_patient_origins (organization_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS clinic_patient_origins_organization_id_idx
  ON public.clinic_patient_origins (organization_id, is_active, name);

COMMENT ON TABLE public.clinic_patient_origins IS
  'Origens do paciente (Instagram, indicação, Google...) cadastradas pelo master da clínica.';

DROP TRIGGER IF EXISTS clinic_patient_origins_updated_at ON public.clinic_patient_origins;
CREATE TRIGGER clinic_patient_origins_updated_at
  BEFORE UPDATE ON public.clinic_patient_origins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS origin_id uuid REFERENCES public.clinic_patient_origins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS patients_origin_id_idx
  ON public.patients (origin_id);

COMMENT ON COLUMN public.patients.origin_id IS
  'Origem cadastrada pelo master da clínica. Nulo em salão e profissional único.';

ALTER TABLE public.clinic_patient_origins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members can read patient origins" ON public.clinic_patient_origins;
CREATE POLICY "Clinic members can read patient origins"
  ON public.clinic_patient_origins
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_member_organization_ids(auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = organization_id
        AND o.type = 'clinic'
    )
  );

DROP POLICY IF EXISTS "Clinic owners can insert patient origins" ON public.clinic_patient_origins;
CREATE POLICY "Clinic owners can insert patient origins"
  ON public.clinic_patient_origins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = organization_id
        AND o.type = 'clinic'
    )
  );

DROP POLICY IF EXISTS "Clinic owners can update patient origins" ON public.clinic_patient_origins;
CREATE POLICY "Clinic owners can update patient origins"
  ON public.clinic_patient_origins
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = organization_id
        AND o.type = 'clinic'
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = organization_id
        AND o.type = 'clinic'
    )
  );

DROP POLICY IF EXISTS "Clinic owners can delete patient origins" ON public.clinic_patient_origins;
CREATE POLICY "Clinic owners can delete patient origins"
  ON public.clinic_patient_origins
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = organization_id
        AND o.type = 'clinic'
    )
  );
