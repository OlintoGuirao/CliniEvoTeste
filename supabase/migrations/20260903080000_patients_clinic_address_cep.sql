-- Endereço estruturado no cadastro da clínica (CEP / número / bairro).
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS address_number text;

COMMENT ON COLUMN public.patients.zip_code IS 'CEP do endereço (somente dígitos). Cadastro da clínica.';
COMMENT ON COLUMN public.patients.neighborhood IS 'Bairro do endereço. Cadastro da clínica.';
COMMENT ON COLUMN public.patients.address_number IS 'Número do imóvel. Cadastro da clínica.';
