-- Assinatura padrão do profissional (reutilizada nos termos, evita assinar toda vez)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_signature_data TEXT;

COMMENT ON COLUMN public.profiles.default_signature_data IS 'Assinatura digital padrão do profissional (data URL); usada em termos quando o profissional escolhe usar a assinatura existente';
