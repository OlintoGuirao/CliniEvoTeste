-- Fase 3: Filiais + isolamento WhatsApp e caixa por filial
-- Master da clínica vê todas as filiais; profissional/atendente só a sua.
-- Profissional único (solo): branch_id NULL — comportamento inalterado.

CREATE TABLE public.organization_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  is_active boolean NOT NULL DEFAULT true,
  address text,
  phone text,
  whatsapp_instance_id text,
  pix_key text,
  pix_key_type text,
  pix_receiver_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_branches_org_name_unique UNIQUE (organization_id, name)
);

CREATE UNIQUE INDEX organization_branches_whatsapp_instance_idx
  ON public.organization_branches (whatsapp_instance_id)
  WHERE whatsapp_instance_id IS NOT NULL;

CREATE INDEX organization_branches_organization_id_idx
  ON public.organization_branches (organization_id);

COMMENT ON TABLE public.organization_branches IS
  'Unidades/filiais de uma clínica. Solo não usa esta tabela.';

DROP TRIGGER IF EXISTS organization_branches_updated_at ON public.organization_branches;
CREATE TRIGGER organization_branches_updated_at
  BEFORE UPDATE ON public.organization_branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.organization_branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS organization_members_branch_id_idx
  ON public.organization_members (branch_id);

CREATE TABLE public.branch_whatsapp_settings (
  branch_id uuid PRIMARY KEY REFERENCES public.organization_branches(id) ON DELETE CASCADE,
  whatsapp_secretary_enabled boolean NOT NULL DEFAULT true,
  whatsapp_bot_name text NOT NULL DEFAULT 'Secretária Virtual',
  appointment_reminder_24h_enabled boolean NOT NULL DEFAULT false,
  appointment_reminder_24h_message text,
  appointment_reminder_1h_enabled boolean NOT NULL DEFAULT false,
  appointment_presence_confirmation_enabled boolean NOT NULL DEFAULT false,
  birthday_whatsapp_enabled boolean NOT NULL DEFAULT false,
  birthday_whatsapp_message text,
  whatsapp_ignored_phones text[] NOT NULL DEFAULT '{}',
  whatsapp_send_warmup_enabled boolean NOT NULL DEFAULT false,
  whatsapp_send_warmup_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS branch_whatsapp_settings_updated_at ON public.branch_whatsapp_settings;
CREATE TRIGGER branch_whatsapp_settings_updated_at
  BEFORE UPDATE ON public.branch_whatsapp_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.recebimentos
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.organization_branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recebimentos_branch_id ON public.recebimentos(branch_id);

ALTER TABLE public.insumo_entradas_nf
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.organization_branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_insumo_entradas_nf_branch_id ON public.insumo_entradas_nf(branch_id);

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.organization_branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS whatsapp_conversations_branch_idx
  ON public.whatsapp_conversations (branch_id, status, last_message_at DESC);

ALTER TABLE public.whatsapp_promotions
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.organization_branches(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.get_user_branch_ids(p_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id
  FROM public.organization_branches b
  INNER JOIN public.organization_members om
    ON om.organization_id = b.organization_id
   AND om.user_id = p_user_id
   AND om.role = 'owner'
   AND om.branch_id IS NULL
  WHERE b.is_active = true
  UNION
  SELECT om.branch_id
  FROM public.organization_members om
  WHERE om.user_id = p_user_id
    AND om.branch_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_user_branch_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_branch_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_branch_ids(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.user_can_access_branch(
  p_branch_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_branch_id IS NOT NULL
     AND p_branch_id IN (SELECT public.get_user_branch_ids(p_user_id));
$$;

REVOKE ALL ON FUNCTION public.user_can_access_branch(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_branch(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_branch(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_user_default_branch_id(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT om.branch_id
      FROM public.organization_members om
      WHERE om.user_id = p_user_id
        AND om.branch_id IS NOT NULL
      LIMIT 1
    ),
    (
      SELECT b.id
      FROM public.organization_branches b
      INNER JOIN public.organization_members om
        ON om.organization_id = b.organization_id
       AND om.user_id = p_user_id
       AND om.role = 'owner'
      WHERE b.is_active = true
      ORDER BY b.created_at ASC
      LIMIT 1
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_user_default_branch_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_default_branch_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_default_branch_id(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.create_organization_branch(
  p_organization_id uuid,
  p_name text,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id uuid;
  v_org_type public.organization_type;
BEGIN
  IF p_organization_id IS NULL OR NULLIF(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'organization_id e name são obrigatórios';
  END IF;

  SELECT type INTO v_org_type FROM public.organizations WHERE id = p_organization_id;
  IF v_org_type IS NULL OR v_org_type <> 'clinic' THEN
    RAISE EXCEPTION 'Filiais só existem em contas do tipo clínica';
  END IF;

  INSERT INTO public.organization_branches (organization_id, name, address, phone)
  VALUES (
    p_organization_id,
    trim(p_name),
    NULLIF(trim(p_address), ''),
    NULLIF(trim(p_phone), '')
  )
  RETURNING id INTO v_branch_id;

  INSERT INTO public.branch_whatsapp_settings (branch_id)
  VALUES (v_branch_id)
  ON CONFLICT (branch_id) DO NOTHING;

  RETURN v_branch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_branch(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_branch(uuid, text, text, text) TO service_role;

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
  IF v_org_type IS NULL OR v_org_type <> 'clinic' THEN
    RAISE EXCEPTION 'Só é possível adicionar membros a uma clínica';
  END IF;

  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Use ensure_profile_organization para o Master';
  END IF;

  IF p_branch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_branches b
      WHERE b.id = p_branch_id AND b.organization_id = p_organization_id
    ) THEN
      RAISE EXCEPTION 'Filial inválida para esta clínica';
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
      account_type = 'clinic'
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_clinic_member(uuid, uuid, uuid, public.organization_member_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_clinic_member(uuid, uuid, uuid, public.organization_member_role) TO service_role;

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

INSERT INTO public.organization_branches (organization_id, name)
SELECT o.id, COALESCE(NULLIF(trim(o.name), ''), 'Matriz')
FROM public.organizations o
WHERE o.type = 'clinic'
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_branches b WHERE b.organization_id = o.id
  );

INSERT INTO public.branch_whatsapp_settings (branch_id)
SELECT b.id FROM public.organization_branches b
ON CONFLICT (branch_id) DO NOTHING;

UPDATE public.recebimentos r
SET branch_id = public.get_user_default_branch_id(r.profissional_id)
WHERE r.branch_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = r.profissional_id AND p.account_type = 'clinic'
  );

UPDATE public.insumo_entradas_nf i
SET branch_id = public.get_user_default_branch_id(i.professional_id)
WHERE i.branch_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = i.professional_id AND p.account_type = 'clinic'
  );

ALTER TABLE public.organization_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage branches"
  ON public.organization_branches FOR ALL
  USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');

CREATE POLICY "Clinic members read accessible branches"
  ON public.organization_branches FOR SELECT
  USING (
    id IN (SELECT public.get_user_branch_ids(auth.uid()))
    OR (
      public.is_clinic_owner(auth.uid())
      AND organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
    )
  );

CREATE POLICY "Clinic owner manages branches"
  ON public.organization_branches FOR ALL
  USING (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
  )
  WITH CHECK (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
  );

ALTER TABLE public.branch_whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages branch whatsapp settings"
  ON public.branch_whatsapp_settings FOR ALL
  USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');

CREATE POLICY "Branch members read whatsapp settings"
  ON public.branch_whatsapp_settings FOR SELECT
  USING (public.user_can_access_branch(branch_id, auth.uid()));

CREATE POLICY "Clinic owner updates branch whatsapp settings"
  ON public.branch_whatsapp_settings FOR UPDATE
  USING (public.user_can_access_branch(branch_id, auth.uid()))
  WITH CHECK (public.user_can_access_branch(branch_id, auth.uid()));

CREATE POLICY "Clinic branch read recebimentos"
  ON public.recebimentos FOR SELECT
  USING (
    branch_id IS NOT NULL
    AND public.user_can_access_branch(branch_id, auth.uid())
    AND profissional_id <> auth.uid()
  );

CREATE POLICY "Clinic branch scoped insert recebimentos"
  ON public.recebimentos FOR INSERT
  WITH CHECK (branch_id IS NULL OR public.user_can_access_branch(branch_id, auth.uid()));

CREATE POLICY "Clinic branch scoped update recebimentos"
  ON public.recebimentos FOR UPDATE
  USING (branch_id IS NULL OR public.user_can_access_branch(branch_id, auth.uid()))
  WITH CHECK (branch_id IS NULL OR public.user_can_access_branch(branch_id, auth.uid()));

CREATE POLICY "Clinic branch read insumos"
  ON public.insumo_entradas_nf FOR SELECT
  USING (
    branch_id IS NOT NULL
    AND public.user_can_access_branch(branch_id, auth.uid())
    AND professional_id <> auth.uid()
  );

CREATE POLICY "Clinic branch scoped insumos"
  ON public.insumo_entradas_nf FOR ALL
  USING (branch_id IS NULL OR public.user_can_access_branch(branch_id, auth.uid()))
  WITH CHECK (branch_id IS NULL OR public.user_can_access_branch(branch_id, auth.uid()));

CREATE POLICY "Branch access whatsapp conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (
    branch_id IS NOT NULL
    AND public.user_can_access_branch(branch_id, auth.uid())
  );

-- Master vê programas Botox da equipe (caixa consolidado)
CREATE POLICY "Clinic master read org botox programs"
  ON public.programas_botox FOR SELECT
  USING (
    public.is_clinic_owner(auth.uid())
    AND professional_id IN (
      SELECT om.user_id
      FROM public.organization_members om
      WHERE om.organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
    )
  );

CREATE POLICY "Clinic master read org botox payments"
  ON public.pagamentos FOR SELECT
  USING (
    public.is_clinic_owner(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.programas_botox pb
      WHERE pb.id = pagamentos.programa_id
        AND pb.professional_id IN (
          SELECT om.user_id
          FROM public.organization_members om
          WHERE om.organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
        )
    )
  );
