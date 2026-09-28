-- Cobrança WhatsApp de parcelas de orçamento aceito

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS auto_send_budget_quote_billing BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.professional_ui_settings.auto_send_budget_quote_billing IS
  'Se true, no dia de vencimento do orçamento envia cobrança PIX pelo WhatsApp quando houver parcela pendente.';

CREATE TABLE IF NOT EXISTS public.budget_quote_cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_quote_id uuid NOT NULL REFERENCES public.budget_quotes (id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,
  channel text,
  provider_message_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_quote_cobrancas_mes_format CHECK (mes_referencia ~ '^\d{4}-\d{2}$'),
  CONSTRAINT budget_quote_cobrancas_unique UNIQUE (budget_quote_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_budget_quote_cobrancas_quote
  ON public.budget_quote_cobrancas (budget_quote_id, mes_referencia);

ALTER TABLE public.budget_quote_cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY budget_quote_cobrancas_select ON public.budget_quote_cobrancas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.budget_quotes bq
      WHERE bq.id = budget_quote_cobrancas.budget_quote_id
        AND bq.professional_id = auth.uid()
    )
  );

COMMENT ON TABLE public.budget_quote_cobrancas IS
  'Registro de cobranças WhatsApp enviadas por mês de orçamento.';
