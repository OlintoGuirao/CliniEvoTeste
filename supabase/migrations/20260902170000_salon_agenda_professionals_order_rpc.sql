-- Salão: owner grava ordem/apelido da agenda via RPC (bypassa RLS de update em organization_members).

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS agenda_label_nickname text,
  ADD COLUMN IF NOT EXISTS agenda_sort_order int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.save_salon_agenda_professionals_order(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_org_type public.organization_type;
  v_item jsonb;
  v_user_id uuid;
  v_nickname text;
  v_sort int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Lista de profissionais inválida';
  END IF;

  SELECT om.organization_id, o.type
    INTO v_org_id, v_org_type
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
    AND om.role = 'owner'
  LIMIT 1;

  IF v_org_id IS NULL OR v_org_type <> 'salon' THEN
    RAISE EXCEPTION 'Acesso restrito ao admin do salão';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_user_id := (v_item ->> 'user_id')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'user_id inválido';
    END;

    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'user_id é obrigatório';
    END IF;

    v_nickname := NULLIF(left(trim(COALESCE(v_item ->> 'agenda_label_nickname', '')), 40), '');
    BEGIN
      v_sort := COALESCE((v_item ->> 'agenda_sort_order')::int, 0);
    EXCEPTION WHEN others THEN
      v_sort := 0;
    END;

    IF v_sort < 0 THEN
      v_sort := 0;
    END IF;
    IF v_sort > 999 THEN
      v_sort := 999;
    END IF;

    UPDATE public.organization_members om
    SET
      agenda_label_nickname = v_nickname,
      agenda_sort_order = v_sort
    WHERE om.organization_id = v_org_id
      AND om.user_id = v_user_id
      AND om.role <> 'attendant';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Profissional não encontrado na equipe do salão';
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.save_salon_agenda_professionals_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_salon_agenda_professionals_order(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_salon_agenda_professionals_order(jsonb) TO service_role;

COMMENT ON FUNCTION public.save_salon_agenda_professionals_order(jsonb) IS
  'Admin do salão salva apelido e ordem dos profissionais na agenda (organization_members).';
