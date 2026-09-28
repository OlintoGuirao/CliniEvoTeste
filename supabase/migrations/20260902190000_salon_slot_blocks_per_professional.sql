-- Salao: admin da org pode bloquear horario na agenda de um profissional da equipe
-- (um bloqueio por profissional; a grade nao compartilha o bloqueio entre colunas).

DROP POLICY IF EXISTS "Org owners manage team slot blocks" ON public.agenda_slot_blocks;
CREATE POLICY "Org owners manage team slot blocks"
  ON public.agenda_slot_blocks
  FOR ALL
  TO authenticated
  USING (public.is_org_team_professional(professional_id))
  WITH CHECK (public.is_org_team_professional(professional_id));
