-- Situação operacional do agendamento na clínica (A confirmar, Em espera, etc.).

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS clinic_status text;

UPDATE public.appointments
SET clinic_status = CASE
  WHEN presence_declined_at IS NOT NULL THEN 'cancelled_by_patient'
  WHEN presence_confirmed_at IS NOT NULL THEN 'confirmed'
  ELSE 'to_confirm'
END
WHERE clinic_status IS NULL;

ALTER TABLE public.appointments
  ALTER COLUMN clinic_status SET DEFAULT 'to_confirm';

UPDATE public.appointments SET clinic_status = 'to_confirm' WHERE clinic_status IS NULL;

ALTER TABLE public.appointments
  ALTER COLUMN clinic_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_clinic_status_check'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_clinic_status_check
      CHECK (
        clinic_status IN (
          'to_confirm',
          'confirmed_by_patient',
          'confirmed',
          'waiting',
          'payment',
          'pre_attendance',
          'in_progress',
          'finished',
          'cancelled_by_professional',
          'cancelled_by_patient',
          'no_show'
        )
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.appointments.clinic_status IS
  'Situação do agendamento na clínica: a confirmar, confirmado, em espera, pagamento, etc.';
