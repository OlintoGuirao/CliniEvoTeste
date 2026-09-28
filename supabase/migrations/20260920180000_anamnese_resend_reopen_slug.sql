-- Permite reenvio da anamnese: se já estiver assinada, reabre (limpa assinatura)
-- e garante o slug público para o paciente preencher de novo.

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

  -- Reenvio: limpa assinatura para o paciente poder preencher/assinar de novo
  IF coalesce(v_completed, false) THEN
    UPDATE public.patient_anamnese
    SET signature_data = NULL,
        signed_at = NULL,
        updated_at = now()
    WHERE patient_id = p_patient_id;
    v_completed := false;
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
  'Gera ou retorna slug público da anamnese; se já assinada, reabre (limpa assinatura) para reenvio.';
