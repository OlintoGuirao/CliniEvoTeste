-- Limite de promoção por agendamentos confirmados (não por quem recebeu a mensagem)
COMMENT ON COLUMN public.whatsapp_promotions.max_participants IS
  'Limite de agendamentos confirmados com a promoção. NULL = ilimitado.';
COMMENT ON COLUMN public.whatsapp_promotions.claimed_count IS
  'Agendamentos confirmados que consumiram a promoção.';

CREATE TABLE IF NOT EXISTS public.whatsapp_promotion_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.whatsapp_promotions(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id UUID,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_promotion_bookings_promo_phone
  ON public.whatsapp_promotion_bookings (promotion_id, phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_promotion_bookings_professional
  ON public.whatsapp_promotion_bookings (professional_id, created_at DESC);

ALTER TABLE public.whatsapp_promotion_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional vê agendamentos de promoções" ON public.whatsapp_promotion_bookings;
CREATE POLICY "Profissional vê agendamentos de promoções"
  ON public.whatsapp_promotion_bookings FOR SELECT
  TO authenticated
  USING (professional_id = auth.uid());
