-- Admin do salão/clínica pode ler sessões da equipe (agenda, dashboard, faturamento).

DROP POLICY IF EXISTS "Org owners read team patient_sessions" ON public.patient_sessions;
CREATE POLICY "Org owners read team patient_sessions"
  ON public.patient_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_team_professional(professional_id)
    OR EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_org_team_professional(p.professional_id)
    )
  );
