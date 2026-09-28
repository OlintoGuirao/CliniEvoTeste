-- Link público para o paciente preencher a anamnese (somente enquanto não assinada).

ALTER TABLE public.patient_anamnese
  ADD COLUMN IF NOT EXISTS public_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_anamnese_public_slug_unique
  ON public.patient_anamnese (lower(trim(public_slug)))
  WHERE public_slug IS NOT NULL;

COMMENT ON COLUMN public.patient_anamnese.public_slug IS
  'Slug público para o paciente preencher a anamnese via link (/pa/:slug).';

CREATE OR REPLACE FUNCTION public._allocate_anamnese_public_slug()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_slug text;
  i int := 0;
BEGIN
  WHILE i < 25 LOOP
    SELECT string_agg(
      substr('abcdefghjkmnpqrstuvwxyz23456789', (floor(random() * 31) + 1)::int, 1),
      ''
    )
    INTO v_slug
    FROM generate_series(1, 10);

    IF NOT EXISTS (
      SELECT 1 FROM public.patient_anamnese pa WHERE lower(trim(pa.public_slug)) = lower(trim(v_slug))
    ) THEN
      RETURN v_slug;
    END IF;
    i := i + 1;
  END LOOP;
  RAISE EXCEPTION 'could not allocate slug';
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_patient_anamnese_public_slug(p_patient_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_completed boolean;
BEGIN
  IF p_patient_id IS NULL OR NOT public.is_patient_owner(p_patient_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT
    pa.public_slug,
    (pa.signed_at IS NOT NULL OR coalesce(trim(pa.signature_data), '') <> '')
  INTO v_slug, v_completed
  FROM public.patient_anamnese pa
  WHERE pa.patient_id = p_patient_id;

  IF coalesce(v_completed, false) THEN
    RAISE EXCEPTION 'anamnese already completed';
  END IF;

  IF v_slug IS NOT NULL AND length(trim(v_slug)) > 0 THEN
    RETURN trim(v_slug);
  END IF;

  v_slug := public._allocate_anamnese_public_slug();

  INSERT INTO public.patient_anamnese (patient_id, data, public_slug)
  VALUES (p_patient_id, '{}'::jsonb, v_slug)
  ON CONFLICT (patient_id) DO UPDATE
  SET public_slug = EXCLUDED.public_slug,
      updated_at = now()
  WHERE public.patient_anamnese.public_slug IS NULL
     OR length(trim(public.patient_anamnese.public_slug)) = 0;

  SELECT pa.public_slug INTO v_slug
  FROM public.patient_anamnese pa
  WHERE pa.patient_id = p_patient_id;

  RETURN trim(v_slug);
END;
$$;

COMMENT ON FUNCTION public.ensure_patient_anamnese_public_slug(uuid) IS
  'Gera ou retorna slug público da anamnese do paciente (apenas se ainda não assinada).';

GRANT EXECUTE ON FUNCTION public.ensure_patient_anamnese_public_slug(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_patient_anamnese(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  j jsonb;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) < 6 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'patient_id', pa.patient_id,
    'data', coalesce(pa.data, '{}'::jsonb),
    'completed', (pa.signed_at IS NOT NULL OR coalesce(trim(pa.signature_data), '') <> ''),
    'signed_at', pa.signed_at,
    'patient', jsonb_build_object('full_name', pt.full_name),
    'professional', (
      SELECT jsonb_build_object(
        'full_name', pf.full_name,
        'app_name', pf.app_name,
        'accent_color', pf.accent_color,
        'app_logo_url', pf.app_logo_url
      )
      FROM public.profiles pf
      WHERE pf.id = pt.professional_id
    )
  )
  INTO j
  FROM public.patient_anamnese pa
  JOIN public.patients pt ON pt.id = pa.patient_id
  WHERE lower(trim(pa.public_slug)) = lower(trim(p_slug))
  LIMIT 1;

  RETURN j;
END;
$$;

COMMENT ON FUNCTION public.get_public_patient_anamnese(text) IS
  'Carrega anamnese pública pelo slug (anon).';

GRANT EXECUTE ON FUNCTION public.get_public_patient_anamnese(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_patient_anamnese(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_patient_anamnese(
  p_slug text,
  p_data jsonb,
  p_signature_data text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_completed boolean;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) < 6 THEN
    RETURN false;
  END IF;
  IF p_data IS NULL OR p_signature_data IS NULL OR length(trim(p_signature_data)) < 20 THEN
    RETURN false;
  END IF;

  SELECT pa.patient_id,
         (pa.signed_at IS NOT NULL OR coalesce(trim(pa.signature_data), '') <> '')
  INTO v_patient_id, v_completed
  FROM public.patient_anamnese pa
  WHERE lower(trim(pa.public_slug)) = lower(trim(p_slug))
  LIMIT 1;

  IF v_patient_id IS NULL OR v_completed THEN
    RETURN false;
  END IF;

  UPDATE public.patient_anamnese
  SET data = coalesce(p_data, '{}'::jsonb),
      signature_data = trim(p_signature_data),
      signed_at = now(),
      updated_at = now()
  WHERE patient_id = v_patient_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.submit_public_patient_anamnese(text, jsonb, text) IS
  'Paciente envia anamnese preenchida e assinada pelo link público.';

GRANT EXECUTE ON FUNCTION public.submit_public_patient_anamnese(text, jsonb, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_patient_anamnese(text, jsonb, text) TO authenticated;
