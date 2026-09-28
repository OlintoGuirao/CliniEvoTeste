-- Tipos de ficha cadastrados pelo master da clínica (HOF, Anamnese HOF, Odonto, Médico...).
-- A recepção pode vincular um ou mais tipos a cada paciente.

CREATE TABLE IF NOT EXISTS public.clinic_record_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_record_types_name_not_empty CHECK (length(trim(name)) >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS clinic_record_types_org_name_idx
  ON public.clinic_record_types (organization_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS clinic_record_types_organization_id_idx
  ON public.clinic_record_types (organization_id, is_active, name);

COMMENT ON TABLE public.clinic_record_types IS
  'Tipos de ficha da clínica (HOF, Anamnese HOF, Odonto, Médico...). Cadastro do master.';

DROP TRIGGER IF EXISTS clinic_record_types_updated_at ON public.clinic_record_types;
CREATE TRIGGER clinic_record_types_updated_at
  BEFORE UPDATE ON public.clinic_record_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.patient_record_types (
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  record_type_id uuid NOT NULL REFERENCES public.clinic_record_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (patient_id, record_type_id)
);

CREATE INDEX IF NOT EXISTS patient_record_types_record_type_id_idx
  ON public.patient_record_types (record_type_id);

COMMENT ON TABLE public.patient_record_types IS
  'Tipos de ficha vinculados ao paciente. Um paciente pode ter vários.';

ALTER TABLE public.clinic_record_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_record_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members can read record types" ON public.clinic_record_types;
CREATE POLICY "Clinic members can read record types"
  ON public.clinic_record_types
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_member_organization_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND o.type = 'clinic'
    )
  );

DROP POLICY IF EXISTS "Clinic owners can insert record types" ON public.clinic_record_types;
CREATE POLICY "Clinic owners can insert record types"
  ON public.clinic_record_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND o.type = 'clinic'
    )
  );

DROP POLICY IF EXISTS "Clinic owners can update record types" ON public.clinic_record_types;
CREATE POLICY "Clinic owners can update record types"
  ON public.clinic_record_types
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND o.type = 'clinic'
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND o.type = 'clinic'
    )
  );

DROP POLICY IF EXISTS "Clinic owners can delete record types" ON public.clinic_record_types;
CREATE POLICY "Clinic owners can delete record types"
  ON public.clinic_record_types
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND o.type = 'clinic'
    )
  );

DROP POLICY IF EXISTS "Clinic members can read patient record types" ON public.patient_record_types;
CREATE POLICY "Clinic members can read patient record types"
  ON public.patient_record_types
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id
        AND (
          p.professional_id = auth.uid()
          OR public.is_clinic_org_colleague(p.professional_id)
        )
    )
  );

DROP POLICY IF EXISTS "Clinic members can insert patient record types" ON public.patient_record_types;
CREATE POLICY "Clinic members can insert patient record types"
  ON public.patient_record_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id
        AND (
          p.professional_id = auth.uid()
          OR public.is_clinic_org_colleague(p.professional_id)
        )
    )
  );

DROP POLICY IF EXISTS "Clinic members can delete patient record types" ON public.patient_record_types;
CREATE POLICY "Clinic members can delete patient record types"
  ON public.patient_record_types
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id
        AND (
          p.professional_id = auth.uid()
          OR public.is_clinic_org_colleague(p.professional_id)
        )
    )
  );
