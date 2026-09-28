-- Admin do salão/clínica pode ver recebimentos da equipe (faturamento consolidado).

DROP POLICY IF EXISTS "Org owners read team recebimentos" ON public.recebimentos;
CREATE POLICY "Org owners read team recebimentos"
  ON public.recebimentos
  FOR SELECT
  TO authenticated
  USING (public.is_org_team_professional(profissional_id));
