-- Fase 2: Master da clínica gerencia profissionais da organização (sem filiais ainda)

-- Helper SECURITY DEFINER: evita recursão RLS ao ler organization_members
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

-- Só donos de CLINICA leem todos os membros.
-- Profissional único (solo) permanece só com "Members can read own membership".
CREATE POLICY "Clinic owners can read org members"
  ON public.organization_members
  FOR SELECT
  USING (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (
      SELECT public.get_owned_organization_ids(auth.uid())
    )
  );

-- Helper: caller é owner de uma clínica?
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

COMMENT ON FUNCTION public.is_clinic_owner IS
  'True se o usuário é owner de uma organização do tipo clinic.';

-- Vincula um profile existente a uma clínica como profissional (service role / admin / clinic owner via API)
CREATE OR REPLACE FUNCTION public.add_clinic_professional(
  p_organization_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_type public.organization_type;
BEGIN
  IF p_organization_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'organization_id e user_id são obrigatórios';
  END IF;

  SELECT type INTO v_org_type FROM public.organizations WHERE id = p_organization_id;
  IF v_org_type IS NULL THEN
    RAISE EXCEPTION 'Organização não encontrada';
  END IF;
  IF v_org_type <> 'clinic' THEN
    RAISE EXCEPTION 'Só é possível adicionar profissionais a uma clínica';
  END IF;

  -- Remove membership anterior, se houver
  DELETE FROM public.organization_members WHERE user_id = p_user_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (p_organization_id, p_user_id, 'professional')
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = 'professional';

  UPDATE public.profiles
  SET organization_id = p_organization_id,
      account_type = 'clinic'
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_clinic_professional(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_clinic_professional(uuid, uuid) TO service_role;

-- Remove profissional da clínica e volta para conta solo
CREATE OR REPLACE FUNCTION public.remove_clinic_professional(
  p_organization_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.organization_member_role;
  v_org_id uuid;
  v_name text;
BEGIN
  SELECT role INTO v_role
  FROM public.organization_members
  WHERE organization_id = p_organization_id
    AND user_id = p_user_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado nesta clínica';
  END IF;
  IF v_role = 'owner' THEN
    RAISE EXCEPTION 'Não é possível remover o Master da clínica por esta função';
  END IF;

  DELETE FROM public.organization_members
  WHERE organization_id = p_organization_id
    AND user_id = p_user_id;

  -- Volta para profissional único com org própria
  SELECT COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(email), ''), 'Profissional')
  INTO v_name
  FROM public.profiles
  WHERE id = p_user_id;

  INSERT INTO public.organizations (name, type)
  VALUES (COALESCE(v_name, 'Profissional'), 'solo')
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'owner');

  UPDATE public.profiles
  SET organization_id = v_org_id,
      account_type = 'solo'
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_clinic_professional(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_clinic_professional(uuid, uuid) TO service_role;
