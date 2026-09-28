-- Garante ordenação determinística das sessões públicas de emagrecimento
-- e inclui created_at/updated_at no payload para desempate no frontend.

CREATE OR REPLACE FUNCTION public.get_public_emagrecimento_report(p_slug text)
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

  SELECT erl.procedure_instance_id
  INTO v_instance_id
  FROM public.emagrecimento_report_links erl
  WHERE lower(trim(erl.slug)) = lower(trim(p_slug))
  LIMIT 1;

  IF v_instance_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
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
      SELECT jsonb_build_object('name', pr.name)
      FROM public.procedure_instances pi2
      INNER JOIN public.procedures pr ON pr.id = pi2.procedure_id
      WHERE pi2.id = v_instance_id
    ),
    'professional', (
      SELECT jsonb_build_object(
        'full_name', pf.full_name,
        'email', pf.email,
        'accent_color', pf.accent_color,
        'professional_registry_body', pf.professional_registry_body,
        'professional_registry_number', pf.professional_registry_number
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
            'observacoes', s.observacoes,
            'created_at', s.created_at,
            'updated_at', s.updated_at
          )
          ORDER BY s.session_date DESC, s.updated_at DESC, s.created_at DESC
        ),
        '[]'::jsonb
      )
      FROM public.procedure_sessions s
      WHERE s.procedure_instance_id = v_instance_id
    )
  )
  INTO j;

  RETURN j;
END;
$$;
