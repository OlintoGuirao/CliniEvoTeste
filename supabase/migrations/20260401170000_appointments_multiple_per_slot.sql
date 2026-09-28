-- Permite mais de uma consulta no mesmo horário (encaixe com outro paciente no mesmo slot).
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_professional_id_appointment_date_start_time_key;
