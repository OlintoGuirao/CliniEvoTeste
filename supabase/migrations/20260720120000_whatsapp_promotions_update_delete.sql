-- Permite editar, ativar/desativar e excluir promoções WhatsApp pelo profissional

DROP POLICY IF EXISTS "Profissional atualiza suas promoções WhatsApp" ON public.whatsapp_promotions;
CREATE POLICY "Profissional atualiza suas promoções WhatsApp"
  ON public.whatsapp_promotions FOR UPDATE
  TO authenticated
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

DROP POLICY IF EXISTS "Profissional exclui suas promoções WhatsApp" ON public.whatsapp_promotions;
CREATE POLICY "Profissional exclui suas promoções WhatsApp"
  ON public.whatsapp_promotions FOR DELETE
  TO authenticated
  USING (professional_id = auth.uid());
