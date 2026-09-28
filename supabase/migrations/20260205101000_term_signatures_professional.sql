-- Assinatura do profissional nos termos (opcional)
ALTER TABLE public.term_signatures
  ADD COLUMN IF NOT EXISTS professional_signature_data TEXT;

COMMENT ON COLUMN public.term_signatures.professional_signature_data IS 'Assinatura digital do profissional (data URL da imagem)';
