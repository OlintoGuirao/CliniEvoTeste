-- Assinatura digital no consentimento LGPD (exibida quando o consentimento já foi registrado)
ALTER TABLE public.lgpd_consents
  ADD COLUMN IF NOT EXISTS signature_data TEXT;

COMMENT ON COLUMN public.lgpd_consents.signature_data IS 'Assinatura digital do paciente (data URL da imagem) ao registrar o consentimento LGPD';
