-- Detalhes completos da promoção (menu do bot: "Ver detalhes")

ALTER TABLE public.whatsapp_promotions
  ADD COLUMN IF NOT EXISTS details_text TEXT;

COMMENT ON COLUMN public.whatsapp_promotions.details_text IS
  'Texto completo exibido quando o paciente escolhe Ver detalhes no menu do bot';
