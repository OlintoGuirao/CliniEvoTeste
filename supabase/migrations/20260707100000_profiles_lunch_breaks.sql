-- Múltiplos intervalos de almoço por profissional
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS lunch_breaks jsonb;

COMMENT ON COLUMN public.profiles.lunch_breaks IS
  'Lista de intervalos de almoço: [{ "start": "12:00", "end": "13:00" }, ...]. lunch_start_time/lunch_end_time mantêm o primeiro intervalo para compatibilidade.';

-- Migra intervalo único legado para o novo formato
UPDATE public.profiles
SET lunch_breaks = jsonb_build_array(
  jsonb_build_object(
    'start', to_char(lunch_start_time, 'HH24:MI'),
    'end', to_char(lunch_end_time, 'HH24:MI')
  )
)
WHERE lunch_breaks IS NULL
  AND lunch_start_time IS NOT NULL
  AND lunch_end_time IS NOT NULL
  AND lunch_end_time > lunch_start_time;
