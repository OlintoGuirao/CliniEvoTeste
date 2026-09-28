-- Dias de trabalho e intervalo de almoço do profissional
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS work_days jsonb DEFAULT '[1,2,3,4,5]'::jsonb,
ADD COLUMN IF NOT EXISTS lunch_start_time time,
ADD COLUMN IF NOT EXISTS lunch_end_time time;
