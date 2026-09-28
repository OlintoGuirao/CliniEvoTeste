-- Clínica: ler perfil do colega (nome, assinatura, conselho) para gerar receita
-- e gravar receita atribuída ao profissional autor.

DROP POLICY IF EXISTS "Clinic members can read clinic colleague profiles"
  ON public.profiles;

CREATE POLICY "Clinic members can read clinic colleague profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_clinic_org_colleague(id));

COMMENT ON POLICY "Clinic members can read clinic colleague profiles"
  ON public.profiles IS
  'Membros da clínica leem perfil dos colegas (assinatura/conselho na receita).';

DROP POLICY IF EXISTS "Clinic members can insert clinic colleague prescriptions"
  ON public.patient_prescriptions;

CREATE POLICY "Clinic members can insert clinic colleague prescriptions"
  ON public.patient_prescriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_clinic_org_colleague(professional_id)
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  );

COMMENT ON POLICY "Clinic members can insert clinic colleague prescriptions"
  ON public.patient_prescriptions IS
  'Recepção pode salvar receita em nome do profissional da clínica.';

DROP POLICY IF EXISTS "Clinic members can update clinic colleague prescriptions"
  ON public.patient_prescriptions;

CREATE POLICY "Clinic members can update clinic colleague prescriptions"
  ON public.patient_prescriptions
  FOR UPDATE
  TO authenticated
  USING (
    public.is_clinic_org_colleague(professional_id)
    OR EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  )
  WITH CHECK (
    public.is_clinic_org_colleague(professional_id)
    OR EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  );
