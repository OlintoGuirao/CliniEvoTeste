-- Corrige recursão RLS e protege contas solo (profissional único).
-- Regra de ouro: tipagem Admin nunca muta organização compartilhada;
-- solo permanece 1:1; clínica só muda quando o usuário é o único membro.

CREATE OR REPLACE FUNCTION public.get_owned_organization_ids(p_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = p_user_id
    AND role = 'owner';
$$;

REVOKE ALL ON FUNCTION public.get_owned_organization_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owned_organization_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owned_organization_ids(uuid) TO service_role;

COMMENT ON FUNCTION public.get_owned_organization_ids IS
  'IDs das organizações em que o usuário é owner (SECURITY DEFINER — evita recursão RLS).';

CREATE OR REPLACE FUNCTION public.get_member_organization_ids(p_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_member_organization_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_organization_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_organization_ids(uuid) TO service_role;

-- Só clínica (solo sempre false)
CREATE OR REPLACE FUNCTION public.is_clinic_owner(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = p_user_id
      AND om.role = 'owner'
      AND o.type = 'clinic'
  );
$$;

REVOKE ALL ON FUNCTION public.is_clinic_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_clinic_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinic_owner(uuid) TO service_role;

DROP POLICY IF EXISTS "Owners can read org members" ON public.organization_members;
DROP POLICY IF EXISTS "Clinic owners can read org members" ON public.organization_members;

-- Só donos de CLINICA leem todos os membros.
-- Solo: permanece apenas "Members can read own membership".
CREATE POLICY "Clinic owners can read org members"
  ON public.organization_members
  FOR SELECT
  USING (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (
      SELECT public.get_owned_organization_ids(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can read own organization" ON public.organizations;

CREATE POLICY "Members can read own organization"
  ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT public.get_member_organization_ids(auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.ensure_profile_organization(
  p_user_id uuid,
  p_account_type public.organization_type DEFAULT 'solo',
  p_org_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_name text;
  v_existing uuid;
  v_caller text;
  v_member_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id é obrigatório';
  END IF;

  v_caller := auth.jwt() ->> 'email';
  IF auth.uid() IS NOT NULL AND (v_caller IS NULL OR v_caller <> 'admin@clinievo.com.br') THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT COALESCE(
    NULLIF(trim(p_org_name), ''),
    NULLIF(trim(full_name), ''),
    NULLIF(trim(email), ''),
    CASE WHEN p_account_type = 'clinic' THEN 'Clínica' ELSE 'Profissional' END
  )
  INTO v_name
  FROM public.profiles
  WHERE id = p_user_id;

  SELECT organization_id INTO v_existing
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_existing IS NOT NULL THEN
    SELECT COUNT(*)::integer INTO v_member_count
    FROM public.organization_members
    WHERE organization_id = v_existing;

    -- Org 1:1 (profissional único ou clínica só com o master): tipa in-place
    IF COALESCE(v_member_count, 0) <= 1 THEN
      UPDATE public.organizations
      SET type = p_account_type,
          name = COALESCE(NULLIF(trim(p_org_name), ''), name),
          updated_at = now()
      WHERE id = v_existing;

      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (v_existing, p_user_id, 'owner')
      ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role = 'owner';

      UPDATE public.profiles
      SET account_type = p_account_type,
          organization_id = v_existing
      WHERE id = p_user_id;

      RETURN v_existing;
    END IF;

    -- Org compartilhada: NÃO altera a clínica/org dos outros.
    -- Destaca este usuário para uma org própria do tipo pedido.
    DELETE FROM public.organization_members
    WHERE organization_id = v_existing
      AND user_id = p_user_id;
  END IF;

  INSERT INTO public.organizations (name, type)
  VALUES (COALESCE(v_name, 'Organização'), p_account_type)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = 'owner';

  UPDATE public.profiles
  SET organization_id = v_org_id,
      account_type = p_account_type
  WHERE id = p_user_id;

  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_profile_organization(uuid, public.organization_type, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_profile_organization(uuid, public.organization_type, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_profile_organization(uuid, public.organization_type, text) TO authenticated;

COMMENT ON FUNCTION public.ensure_profile_organization IS
  'Garante org + membership owner. Solo/clinic 1:1 tipa in-place; org compartilhada destaca o usuário sem afetar os demais.';

-- Heal: profile com org mas sem membership → owner (não mexe em dados clínicos)
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT p.organization_id, p.id, 'owner'
FROM public.profiles p
WHERE p.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = p.id
  )
ON CONFLICT (organization_id, user_id) DO NOTHING;
