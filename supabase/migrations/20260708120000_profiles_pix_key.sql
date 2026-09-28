-- Chave PIX do profissional para cobranças via WhatsApp

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_type text,
  ADD COLUMN IF NOT EXISTS pix_receiver_name text;

COMMENT ON COLUMN public.profiles.pix_key IS 'Chave PIX cadastrada pelo profissional para envio de cobranças.';
COMMENT ON COLUMN public.profiles.pix_key_type IS 'Tipo da chave PIX: cpf, cnpj, email, phone, random.';
COMMENT ON COLUMN public.profiles.pix_receiver_name IS 'Nome do recebedor exibido no QR Code PIX (máx. 25 caracteres).';
