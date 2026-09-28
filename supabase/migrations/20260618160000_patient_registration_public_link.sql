-- Link público para o paciente completar o cadastro (somente enquanto registration_completed_at é null).

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS registration_public_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_registration_public_slug_unique
  ON public.patients (lower(trim(registration_public_slug)))
  WHERE registration_public_slug IS NOT NULL;

COMMENT ON COLUMN public.patients.registration_public_slug IS
  'Slug público para o paciente completar o cadastro via link (/pc/:slug).';

CREATE OR REPLACE FUNCTION public._normalize_phone_br(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_digits text;
BEGIN
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  IF v_digits LIKE '55%' AND length(v_digits) >= 12 THEN
    v_digits := substring(v_digits from 3);
  END IF;
  IF length(v_digits) > 11 THEN
    v_digits := right(v_digits, 11);
  END IF;
  RETURN v_digits;
END;
$$;

CREATE OR REPLACE FUNCTION public._allocate_registration_public_slug()
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
      SELECT 1 FROM public.patients pt WHERE lower(trim(pt.registration_public_slug)) = lower(trim(v_slug))
    ) THEN
      RETURN v_slug;
    END IF;
    i := i + 1;
  END LOOP;
  RAISE EXCEPTION 'could not allocate slug';
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_patient_registration_public_slug(p_patient_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_completed timestamptz;
BEGIN
  IF p_patient_id IS NULL OR NOT public.is_patient_owner(p_patient_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT pt.registration_public_slug, pt.registration_completed_at
  INTO v_slug, v_completed
  FROM public.patients pt
  WHERE pt.id = p_patient_id;

  IF v_completed IS NOT NULL THEN
    RAISE EXCEPTION 'registration already completed';
  END IF;

  IF v_slug IS NOT NULL AND length(trim(v_slug)) > 0 THEN
    RETURN trim(v_slug);
  END IF;

  v_slug := public._allocate_registration_public_slug();

  UPDATE public.patients
  SET registration_public_slug = v_slug,
      updated_at = now()
  WHERE id = p_patient_id
    AND registration_completed_at IS NULL;

  SELECT pt.registration_public_slug INTO v_slug
  FROM public.patients pt
  WHERE pt.id = p_patient_id;

  RETURN trim(v_slug);
END;
$$;

COMMENT ON FUNCTION public.ensure_patient_registration_public_slug(uuid) IS
  'Gera ou retorna slug público para o paciente completar o cadastro (apenas pré-cadastro).';

GRANT EXECUTE ON FUNCTION public.ensure_patient_registration_public_slug(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_patient_registration(p_slug text)
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
    'patient_id', pt.id,
    'completed', (pt.registration_completed_at IS NOT NULL),
    'patient', jsonb_build_object(
      'full_name', pt.full_name,
      'cpf', pt.cpf,
      'date_of_birth', pt.date_of_birth,
      'sex', pt.sex,
      'profession', pt.profession,
      'address', pt.address,
      'city', pt.city,
      'phone', pt.phone,
      'referred_by', pt.referred_by,
      'treatment_start_date', pt.treatment_start_date,
      'consultation_objective', pt.consultation_objective,
      'emergency_contact_name', pt.emergency_contact_name,
      'emergency_contact_phone', pt.emergency_contact_phone,
      'general_notes', pt.general_notes
    ),
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
  FROM public.patients pt
  WHERE lower(trim(pt.registration_public_slug)) = lower(trim(p_slug))
    AND pt.registration_completed_at IS NULL
  LIMIT 1;

  IF j IS NOT NULL THEN
    RETURN j;
  END IF;

  -- Link já utilizado: informar conclusão sem expor dados sensíveis.
  SELECT jsonb_build_object(
    'patient_id', pt.id,
    'completed', true,
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
  FROM public.patients pt
  WHERE lower(trim(pt.registration_public_slug)) = lower(trim(p_slug))
    AND pt.registration_completed_at IS NOT NULL
  LIMIT 1;

  RETURN j;
END;
$$;

COMMENT ON FUNCTION public.get_public_patient_registration(text) IS
  'Carrega ficha pública de cadastro pelo slug (anon).';

GRANT EXECUTE ON FUNCTION public.get_public_patient_registration(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_patient_registration(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_patient_registration(
  p_slug text,
  p_data jsonb,
  p_signature_data text,
  p_consent_text text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_professional_id uuid;
  v_completed timestamptz;
  v_full_name text;
  v_phone text;
  v_phone_norm text;
  v_conflict_id uuid;
  v_consent_text text;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) < 6 THEN
    RETURN false;
  END IF;
  IF p_data IS NULL OR p_signature_data IS NULL OR length(trim(p_signature_data)) < 20 THEN
    RETURN false;
  END IF;

  v_full_name := trim(coalesce(p_data->>'full_name', ''));
  IF length(v_full_name) < 2 THEN
    RETURN false;
  END IF;

  SELECT pt.id, pt.professional_id, pt.registration_completed_at
  INTO v_patient_id, v_professional_id, v_completed
  FROM public.patients pt
  WHERE lower(trim(pt.registration_public_slug)) = lower(trim(p_slug))
  LIMIT 1;

  IF v_patient_id IS NULL OR v_completed IS NOT NULL THEN
    RETURN false;
  END IF;

  v_phone := nullif(trim(coalesce(p_data->>'phone', '')), '');
  v_phone_norm := public._normalize_phone_br(v_phone);

  IF v_phone_norm <> '' THEN
    SELECT pt.id
    INTO v_conflict_id
    FROM public.patients pt
    WHERE pt.professional_id = v_professional_id
      AND pt.id <> v_patient_id
      AND public._normalize_phone_br(pt.phone) = v_phone_norm
      AND public._normalize_phone_br(pt.phone) <> ''
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'phone_already_used';
    END IF;
  END IF;

  UPDATE public.patients
  SET
    full_name = v_full_name,
    cpf = nullif(trim(coalesce(p_data->>'cpf', '')), ''),
    date_of_birth = nullif(trim(coalesce(p_data->>'date_of_birth', '')), '')::date,
    sex = CASE
      WHEN coalesce(p_data->>'sex', '') IN ('male', 'female', 'other') THEN p_data->>'sex'
      ELSE NULL
    END::public.patient_sex,
    profession = nullif(trim(coalesce(p_data->>'profession', '')), ''),
    address = nullif(trim(coalesce(p_data->>'address', '')), ''),
    city = nullif(trim(coalesce(p_data->>'city', '')), ''),
    phone = nullif(v_phone_norm, ''),
    referred_by = nullif(trim(coalesce(p_data->>'referred_by', '')), ''),
    treatment_start_date = coalesce(
      nullif(trim(coalesce(p_data->>'treatment_start_date', '')), '')::date,
      current_date
    ),
    consultation_objective = nullif(trim(coalesce(p_data->>'consultation_objective', '')), ''),
    emergency_contact_name = nullif(trim(coalesce(p_data->>'emergency_contact_name', '')), ''),
    emergency_contact_phone = nullif(trim(coalesce(p_data->>'emergency_contact_phone', '')), ''),
    general_notes = nullif(trim(coalesce(p_data->>'general_notes', '')), ''),
    registration_completed_at = now(),
    updated_at = now()
  WHERE id = v_patient_id
    AND registration_completed_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_consent_text := nullif(trim(coalesce(p_consent_text, '')), '');
  IF v_consent_text IS NULL THEN
    v_consent_text := 'Consentimento LGPD para uso e armazenamento de imagens e dados pessoais.';
  END IF;

  INSERT INTO public.lgpd_consents (
    patient_id,
    consent_given,
    consent_date,
    consent_text,
    signature_data
  )
  VALUES (
    v_patient_id,
    true,
    now(),
    v_consent_text,
    trim(p_signature_data)
  )
  ON CONFLICT (patient_id) DO UPDATE
  SET
    consent_given = EXCLUDED.consent_given,
    consent_date = EXCLUDED.consent_date,
    consent_text = EXCLUDED.consent_text,
    signature_data = EXCLUDED.signature_data,
    updated_at = now();

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.submit_public_patient_registration(text, jsonb, text, text) IS
  'Paciente completa o cadastro e assina LGPD pelo link público.';

GRANT EXECUTE ON FUNCTION public.submit_public_patient_registration(text, jsonb, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_patient_registration(text, jsonb, text, text) TO authenticated;
