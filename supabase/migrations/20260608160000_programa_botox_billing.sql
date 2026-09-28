-- Cobrança automática do Programa de Botox (Evolution API)

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS auto_send_programa_botox_billing BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.professional_ui_settings.auto_send_programa_botox_billing IS
  'Envia mensagem de cobrança do Clube Botox no dia_vencimento via WhatsApp (Evolution API).';

CREATE TABLE IF NOT EXISTS public.programa_botox_cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id UUID NOT NULL REFERENCES public.programas_botox(id) ON DELETE CASCADE,
  mes_referencia TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'evolution',
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS programa_botox_cobrancas_programa_mes_idx
  ON public.programa_botox_cobrancas(programa_id, mes_referencia);

CREATE INDEX IF NOT EXISTS programa_botox_cobrancas_sent_at_idx
  ON public.programa_botox_cobrancas(sent_at DESC);

COMMENT ON TABLE public.programa_botox_cobrancas IS
  'Histórico de cobranças WhatsApp do programa de Botox (evita duplicata no envio automático).';

ALTER TABLE public.programa_botox_cobrancas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS programa_botox_cobrancas_professional_access ON public.programa_botox_cobrancas;

CREATE POLICY programa_botox_cobrancas_professional_access
  ON public.programa_botox_cobrancas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.programas_botox pb
      WHERE pb.id = programa_botox_cobrancas.programa_id
        AND pb.professional_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.programas_botox pb
      WHERE pb.id = programa_botox_cobrancas.programa_id
        AND pb.professional_id = auth.uid()
    )
  );
