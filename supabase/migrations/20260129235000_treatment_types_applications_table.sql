-- Permite que cada tipo de procedimento use uma tabela dedicada de aplicações.
-- Quando preenchido, o sistema usa esta tabela em vez da genérica treatment_applications.
-- Nome sugerido pelo script SQL: {slug_do_nome}_applications (ex: limpeza_de_pele_applications).
ALTER TABLE public.treatment_types
  ADD COLUMN IF NOT EXISTS applications_table TEXT NULL;

COMMENT ON COLUMN public.treatment_types.applications_table IS 'Nome da tabela dedicada de aplicações (ex: limpeza_de_pele_applications). Nulo = usar treatment_applications.';
