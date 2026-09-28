-- Orçamentos (linhas em JSON) + link público /ro/{slug}

CREATE TABLE IF NOT EXISTS public.budget_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  title text,
  notes text,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_quotes_lines_is_array CHECK (jsonb_typeof(lines) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_budget_quotes_professional_updated
  ON public.budget_quotes (professional_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_quotes_patient ON public.budget_quotes (patient_id);

DROP TRIGGER IF EXISTS budget_quotes_updated_at ON public.budget_quotes;
CREATE TRIGGER budget_quotes_updated_at
  BEFORE UPDATE ON public.budget_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.budget_quotes IS 'Orçamentos: linhas com procedure_id, procedure_name, quantity, unit_price (JSON).';

CREATE TABLE IF NOT EXISTS public.budget_quote_public_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_quote_id uuid NOT NULL UNIQUE REFERENCES public.budget_quotes (id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_quote_public_links_slug_lower
  ON public.budget_quote_public_links (lower(trim(slug)));

COMMENT ON TABLE public.budget_quote_public_links IS 'Slug secreto para visualização pública do orçamento (/ro/{slug}).';

ALTER TABLE public.budget_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_quote_public_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.budget_quote_public_links FROM PUBLIC;

CREATE POLICY budget_quotes_select ON public.budget_quotes
  FOR SELECT
  USING (
    professional_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = budget_quotes.patient_id
        AND p.professional_id = auth.uid()
    )
  );

CREATE POLICY budget_quotes_insert ON public.budget_quotes
  FOR INSERT
  WITH CHECK (
    professional_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND p.professional_id = auth.uid()
    )
  );

CREATE POLICY budget_quotes_update ON public.budget_quotes
  FOR UPDATE
  USING (professional_id = auth.uid())
  WITH CHECK (
    professional_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND p.professional_id = auth.uid()
    )
  );

CREATE POLICY budget_quotes_delete ON public.budget_quotes
  FOR DELETE
  USING (professional_id = auth.uid());

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_budget_quote_public_link(p_budget_quote_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_existing text;
  i int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.budget_quotes bq
    WHERE bq.id = p_budget_quote_id
      AND bq.professional_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT bql.slug
  INTO v_existing
  FROM public.budget_quote_public_links bql
  WHERE bql.budget_quote_id = p_budget_quote_id;

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
      INSERT INTO public.budget_quote_public_links (budget_quote_id, slug)
      VALUES (p_budget_quote_id, v_slug);
      RETURN v_slug;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT bql.slug
        INTO v_existing
        FROM public.budget_quote_public_links bql
        WHERE bql.budget_quote_id = p_budget_quote_id;
        IF v_existing IS NOT NULL THEN
          RETURN v_existing;
        END IF;
        i := i + 1;
    END;
  END LOOP;

  RAISE EXCEPTION 'could not allocate slug';
END;
$$;

COMMENT ON FUNCTION public.ensure_budget_quote_public_link(uuid) IS
  'Garante slug público único por orçamento (profissional dono).';

GRANT EXECUTE ON FUNCTION public.ensure_budget_quote_public_link(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
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

COMMENT ON FUNCTION public.get_public_budget_quote(text) IS
  'Payload JSON do orçamento para exibição pública (anon).';

GRANT EXECUTE ON FUNCTION public.get_public_budget_quote(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_budget_quote(text) TO authenticated;
