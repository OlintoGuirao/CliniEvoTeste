-- Preferência: como abrir a agenda ao usar "Agendar próxima avaliação" (dia / semana / mês).
-- Permite que o próprio profissional insira/atualize sua linha (antes só admin podia alterar).

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS agenda_open_mode TEXT NOT NULL DEFAULT 'dia'
  CHECK (agenda_open_mode IN ('dia', 'semana', 'mes'));

COMMENT ON COLUMN public.professional_ui_settings.agenda_open_mode IS
  'Como abrir a agenda ao agendar próxima avaliação: dia (modal de horários), semana ou mês (página Agenda).';

DROP POLICY IF EXISTS "Apenas admin altera config global de UI" ON public.professional_ui_settings;

CREATE POLICY "Profissional insere própria config global de UI"
  ON public.professional_ui_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Profissional atualiza própria config global de UI"
  ON public.professional_ui_settings
  FOR UPDATE
  TO authenticated
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Admin gerencia qualquer config global de UI"
  ON public.professional_ui_settings
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');
