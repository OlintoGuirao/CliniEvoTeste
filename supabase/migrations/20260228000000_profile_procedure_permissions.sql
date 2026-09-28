-- =============================================================================
-- Permissões de visibilidade de procedimentos por perfil (admin)
-- Idempotente: pode ser executada mesmo se a tabela já existir.
-- =============================================================================

-- Tabela: qual procedimento é visível para qual perfil
CREATE TABLE IF NOT EXISTS public.profile_procedure_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
    visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT profile_procedure_permissions_unique UNIQUE (profile_id, procedure_id)
);

COMMENT ON TABLE public.profile_procedure_permissions IS 'Visibilidade de procedimentos por perfil; usado pelo painel admin para configurar o que cada perfil vê.';

CREATE INDEX IF NOT EXISTS idx_profile_procedure_permissions_profile_id ON public.profile_procedure_permissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_procedure_permissions_procedure_id ON public.profile_procedure_permissions(procedure_id);

ALTER TABLE public.profile_procedure_permissions ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para recriar (evita erro se já existirem)
DROP POLICY IF EXISTS "Admin can manage all profile_procedure_permissions" ON public.profile_procedure_permissions;
DROP POLICY IF EXISTS "Authenticated users can read permissions for their profile" ON public.profile_procedure_permissions;

-- RLS: apenas o admin (email específico) pode gerenciar; leitura para o próprio perfil
CREATE POLICY "Admin can manage all profile_procedure_permissions"
    ON public.profile_procedure_permissions
    FOR ALL
    USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br')
    WITH CHECK ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');

CREATE POLICY "Authenticated users can read permissions for their profile"
    ON public.profile_procedure_permissions
    FOR SELECT
    USING (profile_id = auth.uid());

-- =============================================================================
-- RPC: retorna procedimentos visíveis para um perfil (respeitando permissões)
-- Se não houver nenhuma permissão cadastrada para o perfil, retorna todos (compatibilidade).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_procedures_for_profile(p_profile_id UUID)
RETURNS SETOF public.procedures
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.*
    FROM public.procedures p
    WHERE p.is_active = true
      AND (p.is_global = true OR p.created_by = p_profile_id)
      AND (
          NOT EXISTS (
              SELECT 1 FROM public.profile_procedure_permissions perm
              WHERE perm.profile_id = p_profile_id
          )
          OR
          EXISTS (
              SELECT 1 FROM public.profile_procedure_permissions perm
              WHERE perm.profile_id = p_profile_id
                AND perm.procedure_id = p.id
                AND perm.visible = true
          )
      )
    ORDER BY p.category, p.name;
$$;

COMMENT ON FUNCTION public.get_procedures_for_profile(UUID) IS 'Lista procedimentos que o perfil tem permissão de ver; usado no app para filtrar lista por perfil.';
