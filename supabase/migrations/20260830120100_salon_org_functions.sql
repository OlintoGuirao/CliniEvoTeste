-- Funções: clínica e salão compartilham Master/equipe.
-- Depende de organization_type ter o valor 'salon'.

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
      AND o.type IN ('clinic', 'salon')
  );
$$;

COMMENT ON FUNCTION public.is_clinic_owner IS
  'True se o usuário é owner de organização clinic ou salon.';

CREATE OR REPLACE FUNCTION public.add_clinic_member(
  p_organization_id uuid,
  p_user_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_role public.organization_member_role DEFAULT 'professional'
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
  IF v_org_type IS NULL OR v_org_type NOT IN ('clinic', 'salon') THEN
    RAISE EXCEPTION 'Só é possível adicionar membros a uma clínica ou salão';
  END IF;

  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Use ensure_profile_organization para o Master';
  END IF;

  IF p_branch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_branches b
      WHERE b.id = p_branch_id AND b.organization_id = p_organization_id
    ) THEN
      RAISE EXCEPTION 'Filial inválida para esta organização';
    END IF;
  END IF;

  DELETE FROM public.organization_members WHERE user_id = p_user_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, branch_id)
  VALUES (p_organization_id, p_user_id, p_role, p_branch_id)
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = EXCLUDED.role,
      branch_id = EXCLUDED.branch_id;

  UPDATE public.profiles
  SET organization_id = p_organization_id,
      account_type = v_org_type
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_clinic_professional(
  p_organization_id uuid,
  p_user_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.add_clinic_member(p_organization_id, p_user_id, p_branch_id, 'professional');
END;
$$;
