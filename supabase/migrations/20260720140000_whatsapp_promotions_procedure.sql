-- Vincula promoção WhatsApp a um procedimento (agendamento direto no bot)

ALTER TABLE public.whatsapp_promotions
  ADD COLUMN IF NOT EXISTS procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_promotions_procedure_id
  ON public.whatsapp_promotions (procedure_id)
  WHERE procedure_id IS NOT NULL;

COMMENT ON COLUMN public.whatsapp_promotions.procedure_id IS
  'Procedimento vinculado: no bot, agendar com a promoção pula a lista e vai direto à escolha de data.';
