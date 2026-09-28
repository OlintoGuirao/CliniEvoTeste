-- Tabela de auditoria para ações sensíveis (login, criação de usuário, exclusões, geração de PDF, etc.)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  ip TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para permitir reexecução (idempotente)
DROP POLICY IF EXISTS "Users can read own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admin can read all audit logs" ON public.audit_logs;

-- Usuário pode listar seus próprios logs; admin pode listar todos
CREATE POLICY "Users can read own audit logs"
  ON public.audit_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin can read all audit logs"
  ON public.audit_logs FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');

-- Inserção apenas via service role (API serverless); sem policy INSERT para authenticated
-- para evitar que o frontend insira. A API usa SUPABASE_SERVICE_ROLE_KEY e ignora RLS.
COMMENT ON TABLE public.audit_logs IS 'Logs de auditoria; inserção apenas pela API serverless (service role).';
