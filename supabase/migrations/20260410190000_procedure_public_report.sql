-- Relatório web público para procedimentos (exceto emagrecimento).
-- URL pública: /rp/{slug}

CREATE TABLE IF NOT EXISTS public.procedure_report_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_instance_id uuid NOT NULL UNIQUE REFERENCES public.procedure_instances (id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procedure_report_links_slug_lower ON public.procedure_report_links (lower(trim(slug)));

COMMENT ON TABLE public.procedure_report_links IS
  'Slug público para relatório HTML genérico de procedimentos (URL /rp/{slug}), exceto emagrecimento.';

ALTER TABLE public.procedure_report_links ENABLE ROW LEVEL SECURITY;

-- Sem políticas públicas: leitura/escrita apenas via funções SECURITY DEFINER.
REVOKE ALL ON public.procedure_report_links FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Profissional dono do paciente: cria/devolve slug (um por instância)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_procedure_report_link(p_procedure_instance_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_existing text;
  v_is_emagrecimento boolean;
  i int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.procedure_instances pi
    INNER JOIN public.patients p ON p.id = pi.patient_id
    WHERE pi.id = p_procedure_instance_id
      AND p.professional_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT (pr.slug = 'emagrecimento-reducao-medidas')
  INTO v_is_emagrecimento
  FROM public.procedure_instances pi
  INNER JOIN public.procedures pr ON pr.id = pi.procedure_id
  WHERE pi.id = p_procedure_instance_id;

  IF coalesce(v_is_emagrecimento, false) THEN
    RAISE EXCEPTION 'use ensure_emagrecimento_report_link for this procedure';
  END IF;

  SELECT prl.slug
  INTO v_existing
  FROM public.procedure_report_links prl
  WHERE prl.procedure_instance_id = p_procedure_instance_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  WHILE i < 25 LOOP
    SELECT string_agg(
      substr('abcdefghjkmnpqrstuvwxyz23456789', (floor(random() * 31) + 1)::int, 1),
      ''
    )
    INTO v_slug
    FROM generate_series(1, 10);

    BEGIN
      INSERT INTO public.procedure_report_links (procedure_instance_id, slug)
      VALUES (p_procedure_instance_id, v_slug);
      RETURN v_slug;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT prl.slug
        INTO v_existing
        FROM public.procedure_report_links prl
        WHERE prl.procedure_instance_id = p_procedure_instance_id;
        IF v_existing IS NOT NULL THEN
          RETURN v_existing;
        END IF;
        i := i + 1;
    END;
  END LOOP;

  RAISE EXCEPTION 'could not allocate slug';
END;
$$;

COMMENT ON FUNCTION public.ensure_procedure_report_link(uuid) IS
  'Garante slug público único por instância de procedimento (exceto emagrecimento), com validação de ownership.';

GRANT EXECUTE ON FUNCTION public.ensure_procedure_report_link(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Leitura pública: via slug válido + procedimento diferente de emagrecimento
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_procedure_report(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_instance_id uuid;
  j jsonb;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) < 6 THEN
    RETURN NULL;
  END IF;

  SELECT prl.procedure_instance_id
  INTO v_instance_id
  FROM public.procedure_report_links prl
  WHERE lower(trim(prl.slug)) = lower(trim(p_slug))
  LIMIT 1;

  IF v_instance_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.procedure_instances pi
    INNER JOIN public.procedures pr ON pr.id = pi.procedure_id
    WHERE pi.id = v_instance_id
      AND pr.slug = 'emagrecimento-reducao-medidas'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'patient', (
      SELECT jsonb_build_object(
        'full_name', pa.full_name,
        'sex', pa.sex,
        'date_of_birth', pa.date_of_birth,
        'treatment_start_date', pa.treatment_start_date
      )
      FROM public.procedure_instances pi2
      INNER JOIN public.patients pa ON pa.id = pi2.patient_id
      WHERE pi2.id = v_instance_id
    ),
    'instance', (
      SELECT jsonb_build_object(
        'id', pi2.id,
        'data_inicio', pi2.data_inicio
      )
      FROM public.procedure_instances pi2
      WHERE pi2.id = v_instance_id
    ),
    'procedure', (
      SELECT jsonb_build_object(
        'id', pr.id,
        'slug', pr.slug,
        'name', pr.name
      )
      FROM public.procedure_instances pi2
      INNER JOIN public.procedures pr ON pr.id = pi2.procedure_id
      WHERE pi2.id = v_instance_id
    ),
    'professional', (
      SELECT jsonb_build_object(
        'full_name', pf.full_name,
        'accent_color', pf.accent_color
      )
      FROM public.procedure_instances pi2
      INNER JOIN public.profiles pf ON pf.id = pi2.professional_id
      WHERE pi2.id = v_instance_id
    ),
    'fields', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', f.id,
            'procedure_id', f.procedure_id,
            'field_key', f.field_key,
            'label', f.label,
            'field_type', f.field_type,
            'options', coalesce(f.options, '[]'::jsonb),
            'sort_order', f.sort_order
          )
          ORDER BY f.sort_order
        ),
        '[]'::jsonb
      )
      FROM public.procedure_fields f
      INNER JOIN public.procedure_instances pi2 ON pi2.procedure_id = f.procedure_id
      WHERE pi2.id = v_instance_id
    ),
    'sessions', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'procedure_instance_id', s.procedure_instance_id,
            'session_date', s.session_date,
            'data', coalesce(s.data, '{}'::jsonb),
            'observacoes', coalesce(s.observacoes, '')
          )
          ORDER BY s.session_date DESC
        ),
        '[]'::jsonb
      )
      FROM public.procedure_sessions s
      WHERE s.procedure_instance_id = v_instance_id
    ),
    'photos', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', ph.id,
            'procedure_instance_id', ph.procedure_instance_id,
            'procedure_session_id', ph.procedure_session_id,
            'photo_type', ph.photo_type,
            'file_url', ph.file_url,
            'created_at', ph.created_at
          )
          ORDER BY ph.created_at DESC
        ),
        '[]'::jsonb
      )
      FROM public.procedure_photos ph
      WHERE ph.procedure_instance_id = v_instance_id
    )
  )
  INTO j;

  RETURN j;
END;
$$;

COMMENT ON FUNCTION public.get_public_procedure_report(text) IS
  'Payload JSON do relatório público de procedimentos (exceto emagrecimento), para consumo anônimo.';

GRANT EXECUTE ON FUNCTION public.get_public_procedure_report(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_procedure_report(text) TO authenticated;
