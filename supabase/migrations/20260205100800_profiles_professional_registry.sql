-- Órgão/Conselho profissional (COREN, CRBM, CRM, etc.) para termos e identidade
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS professional_registry_body TEXT,
  ADD COLUMN IF NOT EXISTS professional_registry_number TEXT;

COMMENT ON COLUMN public.profiles.professional_registry_body IS 'Órgão/conselho do profissional: COREN, CRBM, CRM, CRF, CRO ou outro (ex.: Enfermagem, Biomedicina, Medicina)';
COMMENT ON COLUMN public.profiles.professional_registry_number IS 'Número de inscrição no conselho (ex.: 123456-SP)';
