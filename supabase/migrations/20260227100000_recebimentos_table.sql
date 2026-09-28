-- =============================================================================
-- Faturamento (sem controle de despesas): recebimentos por procedimento
-- Não permitir exclusão física de registros (sem política DELETE).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.recebimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  profissional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  procedimento_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE RESTRICT,
  valor_total NUMERIC(12, 2) NOT NULL CHECK (valor_total >= 0),
  valor_recebido NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (valor_recebido >= 0),
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('dinheiro', 'cartao', 'pix')),
  status TEXT NOT NULL CHECK (status IN ('pago', 'pendente', 'parcial')),
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT recebimentos_valor_recebido_lte_total CHECK (valor_recebido <= valor_total)
);

COMMENT ON TABLE public.recebimentos IS 'Faturamento: recebimentos por procedimento (sem despesas). Estornos = novo registro; não apagar.';
COMMENT ON COLUMN public.recebimentos.status IS 'pago | pendente | parcial';
COMMENT ON COLUMN public.recebimentos.forma_pagamento IS 'dinheiro | cartao | pix';
COMMENT ON COLUMN public.recebimentos.data IS 'Data do atendimento/pagamento';

CREATE INDEX IF NOT EXISTS idx_recebimentos_profissional_id ON public.recebimentos(profissional_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_data ON public.recebimentos(data DESC);
CREATE INDEX IF NOT EXISTS idx_recebimentos_cliente_id ON public.recebimentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_procedimento_id ON public.recebimentos(procedimento_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_status ON public.recebimentos(status);

-- RLS: sem política DELETE (não permitir exclusão física)
ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional vê seus recebimentos"
  ON public.recebimentos FOR SELECT
  USING (profissional_id = auth.uid());

CREATE POLICY "Profissional insere seus recebimentos"
  ON public.recebimentos FOR INSERT
  WITH CHECK (profissional_id = auth.uid());

CREATE POLICY "Profissional atualiza seus recebimentos"
  ON public.recebimentos FOR UPDATE
  USING (profissional_id = auth.uid())
  WITH CHECK (profissional_id = auth.uid());
