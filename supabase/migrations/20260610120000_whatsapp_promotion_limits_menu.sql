-- Limite de participantes e acesso via menu do bot da Secretária
ALTER TABLE public.whatsapp_promotions
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS max_participants INT,
  ADD COLUMN IF NOT EXISTS claimed_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS menu_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sold_out_message TEXT NOT NULL DEFAULT 'Poxa, acabou a promoção 😔';

ALTER TABLE public.whatsapp_promotions DROP CONSTRAINT IF EXISTS whatsapp_promotions_status_check;
ALTER TABLE public.whatsapp_promotions ADD CONSTRAINT whatsapp_promotions_status_check
  CHECK (status IN ('sending', 'completed', 'failed', 'active', 'exhausted'));

CREATE TABLE IF NOT EXISTS public.whatsapp_promotion_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.whatsapp_promotions(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('menu', 'broadcast')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_promotion_recipients_promo_phone
  ON public.whatsapp_promotion_recipients (promotion_id, phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_promotion_recipients_professional
  ON public.whatsapp_promotion_recipients (professional_id, created_at DESC);

COMMENT ON COLUMN public.whatsapp_promotions.max_participants IS
  'Limite de agendamentos confirmados com a promoção. NULL = ilimitado.';
COMMENT ON COLUMN public.whatsapp_promotions.menu_enabled IS
  'Quando true, a promoção aparece no menu do bot da Secretária enquanto houver vagas.';

ALTER TABLE public.whatsapp_promotion_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional vê destinatários de promoções" ON public.whatsapp_promotion_recipients;
CREATE POLICY "Profissional vê destinatários de promoções"
  ON public.whatsapp_promotion_recipients FOR SELECT
  TO authenticated
  USING (professional_id = auth.uid());
