-- Marca do sistema: nome, descrição e logo (exibidos na sidebar)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS app_name text DEFAULT 'CliniEvo',
ADD COLUMN IF NOT EXISTS app_description text DEFAULT 'Gestão de Tratamentos',
ADD COLUMN IF NOT EXISTS app_logo_url text;

COMMENT ON COLUMN public.profiles.app_name IS 'Nome do app exibido na sidebar';
COMMENT ON COLUMN public.profiles.app_description IS 'Descrição/slogan exibido na sidebar';
COMMENT ON COLUMN public.profiles.app_logo_url IS 'URL da logo (opcional; se null, exibe ícone padrão)';
