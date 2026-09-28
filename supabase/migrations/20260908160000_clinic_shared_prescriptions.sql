-- Clínica: membros da mesma org (ex.: recepção) podem ver receitas
-- criadas por profissionais da clínica nos pacientes da organização.

DROP POLICY IF EXISTS "Clinic members can read clinic colleague prescriptions"
  ON public.patient_prescriptions;

CREATE POLICY "Clinic members can read clinic colleague prescriptions"
  ON public.patient_prescriptions
  FOR SELECT
  TO authenticated
  USING (
    public.is_clinic_org_colleague(professional_id)
    OR EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  );

COMMENT ON POLICY "Clinic members can read clinic colleague prescriptions"
  ON public.patient_prescriptions IS
  'Recepção e demais membros da clínica veem receitas dos profissionais da mesma org.';

-- Modelos de receita: membros da clínica podem listar modelos dos colegas (enviar pela ficha).
DROP POLICY IF EXISTS "Clinic members can read clinic colleague prescription templates"
  ON public.prescription_templates;

CREATE POLICY "Clinic members can read clinic colleague prescription templates"
  ON public.prescription_templates
  FOR SELECT
  TO authenticated
  USING (public.is_clinic_org_colleague(professional_id));

COMMENT ON POLICY "Clinic members can read clinic colleague prescription templates"
  ON public.prescription_templates IS
  'Membros da clínica podem ver modelos de receita dos colegas (somente leitura).';
