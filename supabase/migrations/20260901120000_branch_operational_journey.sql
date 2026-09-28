-- Fluxo operacional da jornada do paciente por filial (unidade da clínica).

CREATE TYPE public.journey_capture_channel AS ENUM (
  'trafego_pago',
  'midia_organica',
  'instagram',
  'facebook',
  'indicacao',
  'espontaneo',
  'parceria',
  'google',
  'acoes_externas'
);

CREATE TYPE public.journey_stage AS ENUM (
  'captacao',
  'cadastro_inicial',
  'agendamento_pendente',
  'agendado',
  'aguardando_confirmacao',
  'nao_agendou',
  'compareceu',
  'nao_compareceu',
  'documentacao_pendente',
  'avaliacao_medica',
  'orcamento_negociacao',
  'orcamento_enviado',
  'fechado',
  'nao_fechado',
  'contrato_pendente',
  'pos_venda',
  'tratamento_iniciado',
  'retencao_recuperacao',
  'encerrado_positivo'
);

CREATE TYPE public.journey_follow_up_status AS ENUM (
  'pending',
  'completed',
  'cancelled',
  'overdue'
);

CREATE TYPE public.journey_follow_up_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

CREATE TABLE public.branch_patient_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.organization_branches(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  current_stage public.journey_stage NOT NULL DEFAULT 'captacao',
  capture_channel public.journey_capture_channel,
  capture_detail text,
  lead_name text,
  lead_phone text,
  lead_email text,
  first_contact_at timestamptz,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  budget_quote_id uuid REFERENCES public.budget_quotes(id) ON DELETE SET NULL,
  procedure_instance_id uuid REFERENCES public.procedure_instances(id) ON DELETE SET NULL,
  no_show_reason text,
  no_schedule_reason text,
  no_close_reason text,
  satisfaction text CHECK (satisfaction IS NULL OR satisfaction IN ('positive', 'neutral', 'negative')),
  satisfaction_notes text,
  priority public.journey_follow_up_priority NOT NULL DEFAULT 'normal',
  notes text,
  next_follow_up_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branch_patient_journeys_patient_or_lead CHECK (
    patient_id IS NOT NULL OR (lead_name IS NOT NULL AND btrim(lead_name) <> '')
  )
);

CREATE INDEX branch_patient_journeys_branch_stage_idx
  ON public.branch_patient_journeys (branch_id, current_stage, updated_at DESC);

CREATE INDEX branch_patient_journeys_patient_idx
  ON public.branch_patient_journeys (patient_id)
  WHERE patient_id IS NOT NULL;

CREATE INDEX branch_patient_journeys_assigned_idx
  ON public.branch_patient_journeys (assigned_user_id, next_follow_up_at)
  WHERE assigned_user_id IS NOT NULL;

CREATE TABLE public.branch_journey_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.branch_patient_journeys(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.organization_branches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  from_stage public.journey_stage,
  to_stage public.journey_stage,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX branch_journey_events_journey_idx
  ON public.branch_journey_events (journey_id, created_at DESC);

CREATE TABLE public.branch_journey_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.branch_patient_journeys(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.organization_branches(id) ON DELETE CASCADE,
  assigned_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  due_at timestamptz NOT NULL,
  priority public.journey_follow_up_priority NOT NULL DEFAULT 'normal',
  reason text NOT NULL,
  status public.journey_follow_up_status NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

CREATE INDEX branch_journey_follow_ups_branch_due_idx
  ON public.branch_journey_follow_ups (branch_id, status, due_at);

-- Impede alteração de filial por usuários comuns.
CREATE OR REPLACE FUNCTION public.branch_journey_guard_branch_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
    IF NOT public.is_clinic_owner(auth.uid()) THEN
      RAISE EXCEPTION 'Transferência de filial exige permissão de Master.';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER branch_patient_journeys_guard_branch
  BEFORE UPDATE ON public.branch_patient_journeys
  FOR EACH ROW EXECUTE FUNCTION public.branch_journey_guard_branch_id();

CREATE OR REPLACE FUNCTION public.resolve_branch_journey_branch_id(p_requested uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_default uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF public.is_clinic_owner(v_uid) THEN
    IF p_requested IS NULL THEN
      RAISE EXCEPTION 'Master deve informar a filial ao criar jornada operacional.';
    END IF;
    IF NOT public.user_can_access_branch(p_requested, v_uid) THEN
      RAISE EXCEPTION 'Filial não autorizada.';
    END IF;
    RETURN p_requested;
  END IF;

  SELECT public.get_user_default_branch_id(v_uid) INTO v_default;
  IF v_default IS NULL THEN
    RAISE EXCEPTION 'Usuário sem filial vinculada.';
  END IF;
  IF p_requested IS NOT NULL AND p_requested <> v_default THEN
    RAISE EXCEPTION 'Não é permitido informar filial diferente da sua unidade.';
  END IF;
  RETURN v_default;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_branch_journey_branch_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_branch_journey_branch_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_branch_patient_journey(
  p_branch_id uuid DEFAULT NULL,
  p_patient_id uuid DEFAULT NULL,
  p_capture_channel public.journey_capture_channel DEFAULT NULL,
  p_capture_detail text DEFAULT NULL,
  p_lead_name text DEFAULT NULL,
  p_lead_phone text DEFAULT NULL,
  p_lead_email text DEFAULT NULL,
  p_first_contact_at timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_assigned_user_id uuid DEFAULT NULL
)
RETURNS public.branch_patient_journeys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_branch uuid;
  v_org uuid;
  v_row public.branch_patient_journeys;
BEGIN
  v_branch := public.resolve_branch_journey_branch_id(p_branch_id);

  SELECT organization_id INTO v_org
  FROM public.organization_branches
  WHERE id = v_branch;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Filial inválida.';
  END IF;

  IF p_patient_id IS NULL AND p_capture_channel IS NULL THEN
    RAISE EXCEPTION 'Canal de captação é obrigatório para novo contato.';
  END IF;

  IF p_assigned_user_id IS NOT NULL AND p_assigned_user_id <> v_uid
     AND NOT public.is_clinic_owner(v_uid) THEN
    -- Membros só atribuem a si ou mantêm default
    RAISE EXCEPTION 'Atribuição a outro usuário exige permissão de Master.';
  END IF;

  INSERT INTO public.branch_patient_journeys (
    organization_id,
    branch_id,
    patient_id,
    professional_id,
    assigned_user_id,
    current_stage,
    capture_channel,
    capture_detail,
    lead_name,
    lead_phone,
    lead_email,
    first_contact_at,
    notes,
    created_by
  ) VALUES (
    v_org,
    v_branch,
    p_patient_id,
    v_uid,
    COALESCE(p_assigned_user_id, v_uid),
    CASE WHEN p_patient_id IS NULL THEN 'captacao'::public.journey_stage ELSE 'cadastro_inicial'::public.journey_stage END,
    p_capture_channel,
    NULLIF(btrim(p_capture_detail), ''),
    NULLIF(btrim(p_lead_name), ''),
    NULLIF(btrim(p_lead_phone), ''),
    NULLIF(btrim(p_lead_email), ''),
    COALESCE(p_first_contact_at, now()),
    NULLIF(btrim(p_notes), ''),
    v_uid
  )
  RETURNING * INTO v_row;

  INSERT INTO public.branch_journey_events (
    journey_id, branch_id, user_id, event_type, to_stage, notes
  ) VALUES (
    v_row.id, v_branch, v_uid, 'journey_created', v_row.current_stage, 'Jornada operacional iniciada'
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_branch_patient_journey(uuid, uuid, public.journey_capture_channel, text, text, text, text, timestamptz, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_branch_patient_journey(uuid, uuid, public.journey_capture_channel, text, text, text, text, timestamptz, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.transition_branch_journey_stage(
  p_journey_id uuid,
  p_to_stage public.journey_stage,
  p_notes text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.branch_patient_journeys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.branch_patient_journeys;
  v_from public.journey_stage;
BEGIN
  SELECT * INTO v_row
  FROM public.branch_patient_journeys
  WHERE id = p_journey_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada não encontrada.';
  END IF;

  IF NOT public.user_can_access_branch(v_row.branch_id, v_uid) THEN
    RAISE EXCEPTION 'Acesso negado à filial desta jornada.';
  END IF;

  v_from := v_row.current_stage;

  UPDATE public.branch_patient_journeys
  SET current_stage = p_to_stage
  WHERE id = p_journey_id
  RETURNING * INTO v_row;

  INSERT INTO public.branch_journey_events (
    journey_id, branch_id, user_id, event_type, from_stage, to_stage, payload, notes
  ) VALUES (
    p_journey_id,
    v_row.branch_id,
    v_uid,
    'stage_transition',
    v_from,
    p_to_stage,
    COALESCE(p_payload, '{}'::jsonb),
    NULLIF(btrim(p_notes), '')
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_branch_journey_stage(uuid, public.journey_stage, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_branch_journey_stage(uuid, public.journey_stage, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_branch_journey_follow_up(
  p_journey_id uuid,
  p_due_at timestamptz,
  p_reason text,
  p_priority public.journey_follow_up_priority DEFAULT 'normal',
  p_assigned_user_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.branch_journey_follow_ups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_journey public.branch_patient_journeys;
  v_row public.branch_journey_follow_ups;
BEGIN
  SELECT * INTO v_journey
  FROM public.branch_patient_journeys
  WHERE id = p_journey_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada não encontrada.';
  END IF;

  IF NOT public.user_can_access_branch(v_journey.branch_id, v_uid) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  INSERT INTO public.branch_journey_follow_ups (
    journey_id,
    branch_id,
    assigned_user_id,
    due_at,
    priority,
    reason,
    notes,
    created_by
  ) VALUES (
    p_journey_id,
    v_journey.branch_id,
    COALESCE(p_assigned_user_id, v_uid),
    p_due_at,
    COALESCE(p_priority, 'normal'),
    btrim(p_reason),
    NULLIF(btrim(p_notes), ''),
    v_uid
  )
  RETURNING * INTO v_row;

  UPDATE public.branch_patient_journeys
  SET next_follow_up_at = p_due_at
  WHERE id = p_journey_id;

  INSERT INTO public.branch_journey_events (
    journey_id, branch_id, user_id, event_type, payload, notes
  ) VALUES (
    p_journey_id,
    v_journey.branch_id,
    v_uid,
    'follow_up_created',
    jsonb_build_object('follow_up_id', v_row.id, 'due_at', p_due_at),
    btrim(p_reason)
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_branch_journey_follow_up(uuid, timestamptz, text, public.journey_follow_up_priority, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_branch_journey_follow_up(uuid, timestamptz, text, public.journey_follow_up_priority, uuid, text) TO authenticated;

-- RLS
ALTER TABLE public.branch_patient_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_journey_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_journey_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branch journey select"
  ON public.branch_patient_journeys FOR SELECT
  USING (public.user_can_access_branch(branch_id, auth.uid()));

CREATE POLICY "Branch journey insert"
  ON public.branch_patient_journeys FOR INSERT
  WITH CHECK (public.user_can_access_branch(branch_id, auth.uid()));

CREATE POLICY "Branch journey update"
  ON public.branch_patient_journeys FOR UPDATE
  USING (public.user_can_access_branch(branch_id, auth.uid()))
  WITH CHECK (public.user_can_access_branch(branch_id, auth.uid()));

CREATE POLICY "Branch journey events select"
  ON public.branch_journey_events FOR SELECT
  USING (public.user_can_access_branch(branch_id, auth.uid()));

CREATE POLICY "Branch journey events insert"
  ON public.branch_journey_events FOR INSERT
  WITH CHECK (public.user_can_access_branch(branch_id, auth.uid()));

CREATE POLICY "Branch journey follow ups select"
  ON public.branch_journey_follow_ups FOR SELECT
  USING (public.user_can_access_branch(branch_id, auth.uid()));

CREATE POLICY "Branch journey follow ups insert"
  ON public.branch_journey_follow_ups FOR INSERT
  WITH CHECK (public.user_can_access_branch(branch_id, auth.uid()));

CREATE POLICY "Branch journey follow ups update"
  ON public.branch_journey_follow_ups FOR UPDATE
  USING (public.user_can_access_branch(branch_id, auth.uid()))
  WITH CHECK (public.user_can_access_branch(branch_id, auth.uid()));
