-- =============================================================================
-- Log de atividades do admin + permissão admin para procedure_instances (gráficos)
-- =============================================================================

-- Tabela de log de atividades (quem fez o quê, quando)
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  admin_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON public.admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_entity ON public.admin_activity_log(entity_type, entity_id);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage activity log" ON public.admin_activity_log;
CREATE POLICY "Admin can manage activity log"
  ON public.admin_activity_log FOR ALL
  USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');

-- Admin pode ler procedure_instances para gráficos do dashboard
DROP POLICY IF EXISTS "Admin can select procedure_instances" ON public.procedure_instances;
CREATE POLICY "Admin can select procedure_instances"
  ON public.procedure_instances FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');
