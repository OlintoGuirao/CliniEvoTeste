-- Clínica: membros da mesma org podem criar/ler/editar orçamentos
-- de pacientes e profissionais da clínica (ex.: plano odontológico → negociação).
-- Solo continua coberto pelas policies originais (professional_id = auth.uid()).

DROP POLICY IF EXISTS "Clinic members can select clinic budget quotes"
  ON public.budget_quotes;
CREATE POLICY "Clinic members can select clinic budget quotes"
  ON public.budget_quotes
  FOR SELECT
  TO authenticated
  USING (
    public.is_clinic_org_colleague(professional_id)
    OR EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  );

DROP POLICY IF EXISTS "Clinic members can insert clinic budget quotes"
  ON public.budget_quotes;
CREATE POLICY "Clinic members can insert clinic budget quotes"
  ON public.budget_quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_clinic_org_colleague(professional_id)
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  );

DROP POLICY IF EXISTS "Clinic members can update clinic budget quotes"
  ON public.budget_quotes;
CREATE POLICY "Clinic members can update clinic budget quotes"
  ON public.budget_quotes
  FOR UPDATE
  TO authenticated
  USING (
    public.is_clinic_org_colleague(professional_id)
    OR EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  )
  WITH CHECK (
    public.is_clinic_org_colleague(professional_id)
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_id
        AND public.is_clinic_org_colleague(p.professional_id)
    )
  );

DROP POLICY IF EXISTS "Clinic members can delete clinic budget quotes"
  ON public.budget_quotes;
CREATE POLICY "Clinic members can delete clinic budget quotes"
  ON public.budget_quotes
  FOR DELETE
  TO authenticated
  USING (public.is_clinic_org_colleague(professional_id));

COMMENT ON POLICY "Clinic members can insert clinic budget quotes"
  ON public.budget_quotes IS
  'Membros da clínica criam orçamento para pacientes/profissionais da mesma org.';

-- Link público do orçamento: permitir colega da clínica (não só o dono).
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
      AND (
        bq.professional_id = auth.uid()
        OR public.is_clinic_org_colleague(bq.professional_id)
      )
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

GRANT EXECUTE ON FUNCTION public.ensure_budget_quote_public_link(uuid) TO authenticated;

COMMENT ON FUNCTION public.ensure_budget_quote_public_link(uuid) IS
  'Gera (ou retorna) slug público do orçamento; dono ou colega de clínica.';
