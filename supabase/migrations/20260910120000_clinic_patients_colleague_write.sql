-- Clínica: qualquer membro pode cadastrar/atualizar paciente vinculado a um colega
-- (campo profissional responsável = patients.professional_id).
-- SELECT de colegas já existe em 20260902180000_clinic_agenda_booking.sql.
-- Salão não é afetado: is_clinic_org_colleague só vale para org type = clinic.

DROP POLICY IF EXISTS "Clinic members insert clinic colleague patients" ON public.patients;
CREATE POLICY "Clinic members insert clinic colleague patients"
  ON public.patients
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_clinic_org_colleague(professional_id));

DROP POLICY IF EXISTS "Clinic members update clinic colleague patients" ON public.patients;
CREATE POLICY "Clinic members update clinic colleague patients"
  ON public.patients
  FOR UPDATE
  TO authenticated
  USING (public.is_clinic_org_colleague(professional_id))
  WITH CHECK (public.is_clinic_org_colleague(professional_id));

COMMENT ON POLICY "Clinic members insert clinic colleague patients" ON public.patients IS
  'Permite criar paciente com professional_id de um colega da mesma clínica.';

COMMENT ON POLICY "Clinic members update clinic colleague patients" ON public.patients IS
  'Permite alterar paciente (incl. profissional responsável) entre colegas da clínica.';
