-- Remove o campo email da tabela patients (não utilizado).
ALTER TABLE public.patients
  DROP COLUMN IF EXISTS email;
