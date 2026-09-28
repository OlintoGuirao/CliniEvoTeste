-- Remove todas as tabelas de tratamentos. Trabalhe apenas com procedimentos
-- (procedures, procedure_instances, procedure_sessions, procedure_photos).
-- Ordem: remover FKs em patients → dependentes → tabelas principais.

-- 1) Remover referência a treatment_types em patients
ALTER TABLE public.patients DROP COLUMN IF EXISTS treatment_type_id;

-- 2) Tabelas antigas de emagrecimento e botox
DROP TABLE IF EXISTS public.patient_photos CASCADE;
DROP TABLE IF EXISTS public.weight_loss_sessions CASCADE;
DROP TABLE IF EXISTS public.weight_loss_programs CASCADE;
DROP TABLE IF EXISTS public.botox_applications CASCADE;

-- 3) Tabelas genéricas de tipos de tratamento e aplicações
DROP TABLE IF EXISTS public.treatment_applications CASCADE;
DROP TABLE IF EXISTS public.treatment_types CASCADE;

-- 4) Enums usados apenas por tabelas removidas
DROP TYPE IF EXISTS public.protocol_type CASCADE;
