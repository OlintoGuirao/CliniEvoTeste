-- Tempo de tratamento no orçamento: valor inteiro + unidade (meses | sessoes)
ALTER TABLE public.budget_quotes
  ADD COLUMN IF NOT EXISTS treatment_time integer;

ALTER TABLE public.budget_quotes
  ADD COLUMN IF NOT EXISTS treatment_time_unit text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budget_quotes'
      AND column_name = 'treatment_time'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.budget_quotes
      ALTER COLUMN treatment_time TYPE integer
      USING CASE
        WHEN treatment_time ~ '^[0-9]+$' THEN treatment_time::integer
        ELSE NULL
      END;
  END IF;
END $$;

ALTER TABLE public.budget_quotes
  DROP CONSTRAINT IF EXISTS budget_quotes_treatment_time_unit_check;

ALTER TABLE public.budget_quotes
  ADD CONSTRAINT budget_quotes_treatment_time_unit_check
  CHECK (
    treatment_time_unit IS NULL
    OR treatment_time_unit IN ('meses', 'sessoes')
  );

COMMENT ON COLUMN public.budget_quotes.treatment_time IS
  'Quantidade do tempo de tratamento (inteiro).';
COMMENT ON COLUMN public.budget_quotes.treatment_time_unit IS
  'Unidade do tempo de tratamento: meses | sessoes.';

CREATE OR REPLACE FUNCTION public.get_public_budget_quote(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_budget_id uuid;
  j jsonb;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) < 6 THEN
    RETURN NULL;
  END IF;

  SELECT bql.budget_quote_id
  INTO v_budget_id
  FROM public.budget_quote_public_links bql
  WHERE lower(trim(bql.slug)) = lower(trim(p_slug))
  LIMIT 1;

  IF v_budget_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'title', bq.title,
    'notes', bq.notes,
    'treatment_time', bq.treatment_time,
    'treatment_time_unit', bq.treatment_time_unit,
    'lines', coalesce(bq.lines, '[]'::jsonb),
    'updated_at', bq.updated_at,
    'patient', (
      SELECT jsonb_build_object('full_name', pa.full_name)
      FROM public.patients pa
      WHERE pa.id = bq.patient_id
    ),
    'professional', (
      SELECT jsonb_build_object(
        'full_name', pf.full_name,
        'app_name', pf.app_name,
        'accent_color', pf.accent_color,
        'theme_palette', pf.theme_palette,
        'app_logo_url', pf.app_logo_url
      )
      FROM public.profiles pf
      WHERE pf.id = bq.professional_id
    )
  )
  INTO j
  FROM public.budget_quotes bq
  WHERE bq.id = v_budget_id;

  RETURN j;
END;
$$;
