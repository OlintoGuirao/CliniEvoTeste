-- FAQ personalizado por profissional para o menu da Secretária WhatsApp

CREATE TABLE IF NOT EXISTS public.whatsapp_bot_faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_bot_faq_items_professional_sort_idx
  ON public.whatsapp_bot_faq_items(professional_id, sort_order, created_at);

COMMENT ON TABLE public.whatsapp_bot_faq_items IS
  'Perguntas e respostas do menu Dúvidas frequentes da Secretária WhatsApp.';

ALTER TABLE public.whatsapp_bot_faq_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_bot_faq_items_professional_access ON public.whatsapp_bot_faq_items;

CREATE POLICY whatsapp_bot_faq_items_professional_access
  ON public.whatsapp_bot_faq_items
  FOR ALL
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());
