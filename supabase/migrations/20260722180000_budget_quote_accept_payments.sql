-- Aceite/recusa de orçamento + planilha de cobrança mensal

-- ---------------------------------------------------------------------------
-- Colunas de status / aceite em budget_quotes
-- ---------------------------------------------------------------------------
ALTER TABLE public.budget_quotes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

ALTER TABLE public.budget_quotes
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

ALTER TABLE public.budget_quotes
  ADD COLUMN IF NOT EXISTS patient_payment_day integer;

ALTER TABLE public.budget_quotes
  ADD COLUMN IF NOT EXISTS patient_payment_method text;

ALTER TABLE public.budget_quotes
  ADD COLUMN IF NOT EXISTS accepted_treatment_time integer;

ALTER TABLE public.budget_quotes
  ADD COLUMN IF NOT EXISTS accepted_treatment_time_unit text;

ALTER TABLE public.budget_quotes
  ADD COLUMN IF NOT EXISTS schedule_start_month text;

ALTER TABLE public.budget_quotes
  DROP CONSTRAINT IF EXISTS budget_quotes_status_check;

ALTER TABLE public.budget_quotes
  ADD CONSTRAINT budget_quotes_status_check
  CHECK (status IN ('open', 'accepted', 'rejected'));

ALTER TABLE public.budget_quotes
  DROP CONSTRAINT IF EXISTS budget_quotes_patient_payment_day_check;

ALTER TABLE public.budget_quotes
  ADD CONSTRAINT budget_quotes_patient_payment_day_check
  CHECK (patient_payment_day IS NULL OR (patient_payment_day >= 1 AND patient_payment_day <= 28));

ALTER TABLE public.budget_quotes
  DROP CONSTRAINT IF EXISTS budget_quotes_patient_payment_method_check;

ALTER TABLE public.budget_quotes
  ADD CONSTRAINT budget_quotes_patient_payment_method_check
  CHECK (
    patient_payment_method IS NULL
    OR patient_payment_method IN ('dinheiro', 'cartao', 'pix')
  );

ALTER TABLE public.budget_quotes
  DROP CONSTRAINT IF EXISTS budget_quotes_accepted_treatment_time_unit_check;

ALTER TABLE public.budget_quotes
  ADD CONSTRAINT budget_quotes_accepted_treatment_time_unit_check
  CHECK (
    accepted_treatment_time_unit IS NULL
    OR accepted_treatment_time_unit IN ('meses', 'sessoes')
  );

CREATE INDEX IF NOT EXISTS idx_budget_quotes_professional_responded
  ON public.budget_quotes (professional_id, responded_at DESC)
  WHERE responded_at IS NOT NULL;

COMMENT ON COLUMN public.budget_quotes.status IS 'open | accepted | rejected';
COMMENT ON COLUMN public.budget_quotes.schedule_start_month IS 'YYYY-MM da primeira parcela';

-- ---------------------------------------------------------------------------
-- Pagamentos mensais do orçamento aceito
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_quote_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_quote_id uuid NOT NULL REFERENCES public.budget_quotes (id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,
  valor numeric NOT NULL CHECK (valor > 0),
  data_pagamento timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_quote_payments_mes_format CHECK (mes_referencia ~ '^\d{4}-\d{2}$'),
  CONSTRAINT budget_quote_payments_unique_mes UNIQUE (budget_quote_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_budget_quote_payments_quote
  ON public.budget_quote_payments (budget_quote_id, mes_referencia);

ALTER TABLE public.budget_quote_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY budget_quote_payments_select ON public.budget_quote_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.budget_quotes bq
      WHERE bq.id = budget_quote_payments.budget_quote_id
        AND bq.professional_id = auth.uid()
    )
  );

CREATE POLICY budget_quote_payments_update ON public.budget_quote_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.budget_quotes bq
      WHERE bq.id = budget_quote_payments.budget_quote_id
        AND bq.professional_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.budget_quotes bq
      WHERE bq.id = budget_quote_payments.budget_quote_id
        AND bq.professional_id = auth.uid()
    )
  );

COMMENT ON TABLE public.budget_quote_payments IS
  'Parcelas mensais do orçamento aceito; data_pagamento preenchido = pago.';

-- ---------------------------------------------------------------------------
-- Helper: total das linhas JSON
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.budget_quote_lines_total(p_lines jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_item jsonb;
  v_sum numeric := 0;
  v_q numeric;
  v_u numeric;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RETURN 0;
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_q := COALESCE(NULLIF(v_item->>'quantity', '')::numeric, 0);
    v_u := COALESCE(NULLIF(v_item->>'unit_price', '')::numeric, 0);
    v_sum := v_sum + (v_q * v_u);
  END LOOP;
  RETURN ROUND(v_sum, 2);
END;
$$;

-- ---------------------------------------------------------------------------
-- get_public_budget_quote (atualizado)
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
    'treatment_time', bq.treatment_time,
    'treatment_time_unit', bq.treatment_time_unit,
    'status', bq.status,
    'responded_at', bq.responded_at,
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

-- ---------------------------------------------------------------------------
-- Recusar orçamento (público)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_reject_budget_quote(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget_id uuid;
  v_status text;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) < 6 THEN
    RAISE EXCEPTION 'slug inválido';
  END IF;

  SELECT bql.budget_quote_id
  INTO v_budget_id
  FROM public.budget_quote_public_links bql
  WHERE lower(trim(bql.slug)) = lower(trim(p_slug))
  LIMIT 1;

  IF v_budget_id IS NULL THEN
    RAISE EXCEPTION 'orçamento não encontrado';
  END IF;

  SELECT bq.status INTO v_status
  FROM public.budget_quotes bq
  WHERE bq.id = v_budget_id
  FOR UPDATE;

  IF v_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'orçamento já respondido';
  END IF;

  UPDATE public.budget_quotes
  SET
    status = 'rejected',
    responded_at = now()
  WHERE id = v_budget_id;

  RETURN jsonb_build_object('ok', true, 'status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_reject_budget_quote(text) TO anon;
GRANT EXECUTE ON FUNCTION public.public_reject_budget_quote(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Aceitar orçamento (público) + gerar parcelas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_accept_budget_quote(
  p_slug text,
  p_payment_day integer,
  p_payment_method text,
  p_treatment_time integer,
  p_treatment_time_unit text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget_id uuid;
  v_status text;
  v_lines jsonb;
  v_total numeric;
  v_n integer;
  v_start_month text;
  v_accept_date date;
  v_accept_day integer;
  v_y integer;
  v_m integer;
  v_i integer;
  v_mes text;
  v_base numeric;
  v_last numeric;
  v_acc numeric := 0;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) < 6 THEN
    RAISE EXCEPTION 'slug inválido';
  END IF;
  IF p_payment_day IS NULL OR p_payment_day < 1 OR p_payment_day > 28 THEN
    RAISE EXCEPTION 'dia de pagamento inválido';
  END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('dinheiro', 'cartao', 'pix') THEN
    RAISE EXCEPTION 'forma de pagamento inválida';
  END IF;
  IF p_treatment_time IS NULL OR p_treatment_time < 1 THEN
    RAISE EXCEPTION 'tempo de tratamento inválido';
  END IF;
  IF p_treatment_time_unit IS NULL OR p_treatment_time_unit NOT IN ('meses', 'sessoes') THEN
    RAISE EXCEPTION 'unidade de tempo inválida';
  END IF;

  SELECT bql.budget_quote_id
  INTO v_budget_id
  FROM public.budget_quote_public_links bql
  WHERE lower(trim(bql.slug)) = lower(trim(p_slug))
  LIMIT 1;

  IF v_budget_id IS NULL THEN
    RAISE EXCEPTION 'orçamento não encontrado';
  END IF;

  SELECT bq.status, bq.lines
  INTO v_status, v_lines
  FROM public.budget_quotes bq
  WHERE bq.id = v_budget_id
  FOR UPDATE;

  IF v_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'orçamento já respondido';
  END IF;

  v_total := public.budget_quote_lines_total(v_lines);
  IF v_total IS NULL OR v_total <= 0 THEN
    RAISE EXCEPTION 'orçamento sem valor';
  END IF;

  v_n := p_treatment_time;
  v_accept_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_accept_day := EXTRACT(DAY FROM v_accept_date)::integer;
  v_y := EXTRACT(YEAR FROM v_accept_date)::integer;
  v_m := EXTRACT(MONTH FROM v_accept_date)::integer;

  -- Se o dia do aceite >= dia de pagamento → começa no mês seguinte
  IF v_accept_day >= p_payment_day THEN
    v_m := v_m + 1;
    IF v_m > 12 THEN
      v_m := 1;
      v_y := v_y + 1;
    END IF;
  END IF;

  v_start_month := lpad(v_y::text, 4, '0') || '-' || lpad(v_m::text, 2, '0');

  v_base := ROUND(v_total / v_n, 2);

  DELETE FROM public.budget_quote_payments WHERE budget_quote_id = v_budget_id;

  FOR v_i IN 0..(v_n - 1) LOOP
    DECLARE
      mm integer := v_m + v_i;
      yy integer := v_y;
    BEGIN
      WHILE mm > 12 LOOP
        mm := mm - 12;
        yy := yy + 1;
      END LOOP;
      v_mes := lpad(yy::text, 4, '0') || '-' || lpad(mm::text, 2, '0');

      IF v_i = v_n - 1 THEN
        v_last := ROUND(v_total - v_acc, 2);
      ELSE
        v_last := v_base;
        v_acc := v_acc + v_base;
      END IF;

      INSERT INTO public.budget_quote_payments (budget_quote_id, mes_referencia, valor, data_pagamento)
      VALUES (v_budget_id, v_mes, GREATEST(v_last, 0.01), NULL);
    END;
  END LOOP;

  UPDATE public.budget_quotes
  SET
    status = 'accepted',
    responded_at = now(),
    patient_payment_day = p_payment_day,
    patient_payment_method = p_payment_method,
    accepted_treatment_time = p_treatment_time,
    accepted_treatment_time_unit = p_treatment_time_unit,
    schedule_start_month = v_start_month
  WHERE id = v_budget_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'accepted',
    'schedule_start_month', v_start_month,
    'installments', v_n,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_accept_budget_quote(text, integer, text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.public_accept_budget_quote(text, integer, text, integer, text) TO authenticated;

COMMENT ON FUNCTION public.public_accept_budget_quote(text, integer, text, integer, text) IS
  'Paciente aceita orçamento público e gera parcelas mensais.';
COMMENT ON FUNCTION public.public_reject_budget_quote(text) IS
  'Paciente recusa orçamento público.';
