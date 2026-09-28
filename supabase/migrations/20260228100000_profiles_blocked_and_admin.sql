-- =============================================================================
-- Bloqueio de usuários (admin) + políticas RLS para painel admin
-- =============================================================================

-- Campos de bloqueio em profiles (1 perfil = 1 usuário)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

COMMENT ON COLUMN public.profiles.is_blocked IS 'Se true, usuário bloqueado pelo admin e não pode usar o sistema';
COMMENT ON COLUMN public.profiles.blocked_at IS 'Data/hora em que o usuário foi bloqueado';
COMMENT ON COLUMN public.profiles.blocked_reason IS 'Motivo do bloqueio (opcional)';

-- Admin pode ver todos os perfis (para listar usuários e dashboard)
DROP POLICY IF EXISTS "Admin can select all profiles" ON public.profiles;
CREATE POLICY "Admin can select all profiles"
  ON public.profiles FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');

-- Admin pode atualizar qualquer perfil (para bloquear/desbloquear)
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
CREATE POLICY "Admin can update any profile"
  ON public.profiles FOR UPDATE
  USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');

-- =============================================================================
-- RPC: estatísticas do painel admin (apenas admin@clinievo.com.br)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email TEXT := auth.jwt() ->> 'email';
  total_usuarios BIGINT;
  bloqueados BIGINT;
  total_procedimentos BIGINT;
BEGIN
  IF admin_email IS NULL OR admin_email <> 'admin@clinievo.com.br' THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT COUNT(*) INTO total_usuarios FROM public.profiles;
  SELECT COUNT(*) INTO bloqueados FROM public.profiles WHERE is_blocked = true;
  SELECT COUNT(*) INTO total_procedimentos FROM public.procedures WHERE is_active = true;

  RETURN json_build_object(
    'total_usuarios', total_usuarios,
    'usuarios_ativos', total_usuarios - bloqueados,
    'usuarios_bloqueados', bloqueados,
    'total_procedimentos', total_procedimentos,
    'total_perfis', total_usuarios
  );
END;
$$;

COMMENT ON FUNCTION public.get_admin_stats() IS 'Métricas do painel admin; apenas admin@clinievo.com.br';
