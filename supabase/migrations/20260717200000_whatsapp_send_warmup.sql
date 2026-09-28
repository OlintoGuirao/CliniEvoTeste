-- Trava de maturidade (warm-up) só para disparos de promoção WhatsApp.
ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS whatsapp_send_warmup_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.professional_ui_settings
  ADD COLUMN IF NOT EXISTS whatsapp_send_warmup_started_at timestamptz;

COMMENT ON COLUMN public.professional_ui_settings.whatsapp_send_warmup_enabled IS
  'Se true, limita gradualmente o volume diário de disparos de promoção WhatsApp (warm-up). Não afeta secretária, lembretes nem cobranças.';

COMMENT ON COLUMN public.professional_ui_settings.whatsapp_send_warmup_started_at IS
  'Início da contagem de maturidade do número (dias desde esta data definem o teto diário de promoções).';

-- Contagem diária de disparos de promoção por profissional.
CREATE TABLE IF NOT EXISTS public.whatsapp_daily_send_counts (
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  send_date date NOT NULL,
  send_count integer NOT NULL DEFAULT 0 CHECK (send_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (professional_id, send_date)
);

CREATE INDEX IF NOT EXISTS whatsapp_daily_send_counts_date_idx
  ON public.whatsapp_daily_send_counts (send_date);

COMMENT ON TABLE public.whatsapp_daily_send_counts IS
  'Contagem de disparos de promoção WhatsApp por profissional/dia (trava de maturidade).';

ALTER TABLE public.whatsapp_daily_send_counts ENABLE ROW LEVEL SECURITY;
