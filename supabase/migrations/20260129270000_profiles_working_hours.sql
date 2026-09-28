-- Adiciona horário de funcionamento do profissional no perfil
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS work_start_time time,
ADD COLUMN IF NOT EXISTS work_end_time time;
