-- Fase 1: conta Clínica vs Profissional Único (controle pelo Admin)
-- Ainda sem filiais/atendentes — só tipagem da organização e vínculo do usuário.

CREATE TYPE public.organization_type AS ENUM ('solo', 'clinic');
CREATE TYPE public.organization_member_role AS ENUM ('owner', 'professional', 'attendant');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.organization_type NOT NULL DEFAULT 'solo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.organization_member_role NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX organization_members_user_id_idx ON public.organization_members (user_id);
CREATE INDEX organization_members_organization_id_idx ON public.organization_members (organization_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_type public.organization_type NOT NULL DEFAULT 'solo';

CREATE INDEX profiles_organization_id_idx ON public.profiles (organization_id);
CREATE INDEX profiles_account_type_idx ON public.profiles (account_type);

COMMENT ON COLUMN public.profiles.account_type IS
  'Tipo da conta definido pelo Admin: solo (profissional único) ou clinic (clínica).';
COMMENT ON COLUMN public.profiles.organization_id IS
  'Organização à qual o perfil pertence. Solo = org 1:1; Clinic = org compartilhada (fases futuras).';

-- Backfill: cada profile atual vira organização solo 1:1
DO $$
DECLARE
  r RECORD;
  org_id uuid;
BEGIN
  FOR r IN
    SELECT id, COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(email), ''), 'Profissional') AS org_name
    FROM public.profiles
    WHERE organization_id IS NULL
  LOOP
    INSERT INTO public.organizations (name, type)
    VALUES (r.org_name, 'solo')
    RETURNING id INTO org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_id, r.id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    UPDATE public.profiles
    SET organization_id = org_id,
        account_type = 'solo'
    WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Admin SaaS vê/gerencia tudo
CREATE POLICY "Admin can manage organizations"
  ON public.organizations
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');

CREATE POLICY "Admin can manage organization_members"
  ON public.organization_members
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');

-- Usuário lê a própria organização / membership
CREATE POLICY "Members can read own organization"
  ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can read own membership"
  ON public.organization_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Helper: cria organização + membership ao criar conta (service role / admin)
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
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id é obrigatório';
  END IF;

  -- service_role (auth.uid null) ou Admin SaaS
  v_caller := auth.jwt() ->> 'email';
  IF auth.uid() IS NOT NULL AND (v_caller IS NULL OR v_caller <> 'admin@clinievo.com.br') THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT organization_id INTO v_existing
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_existing IS NOT NULL THEN
    UPDATE public.organizations
    SET type = p_account_type,
        name = COALESCE(NULLIF(trim(p_org_name), ''), name),
        updated_at = now()
    WHERE id = v_existing;

    UPDATE public.profiles
    SET account_type = p_account_type,
        organization_id = v_existing
    WHERE id = p_user_id;

    RETURN v_existing;
  END IF;

  SELECT COALESCE(
    NULLIF(trim(p_org_name), ''),
    NULLIF(trim(full_name), ''),
    NULLIF(trim(email), ''),
    'Organização'
  )
  INTO v_name
  FROM public.profiles
  WHERE id = p_user_id;

  INSERT INTO public.organizations (name, type)
  VALUES (COALESCE(v_name, 'Organização'), p_account_type)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

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
  'Garante organization + membership para um profile. Usado pelo Admin ao criar/alterar tipo de conta.';
