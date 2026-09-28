-- Troca Pré-atendimento por Remarcado na situação da agenda clínica.

UPDATE public.appointments
SET clinic_status = 'to_confirm'
WHERE clinic_status = 'pre_attendance';

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_clinic_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_clinic_status_check
  CHECK (
    clinic_status IN (
      'to_confirm',
      'confirmed_by_patient',
      'confirmed',
      'waiting',
      'payment',
      'rescheduled',
      'in_progress',
      'finished',
      'cancelled_by_professional',
      'cancelled_by_patient',
      'no_show'
    )
  );

COMMENT ON COLUMN public.appointments.clinic_status IS
  'Situação do agendamento na clínica: a confirmar, confirmado, em espera, pagamento, remarcado, etc.';
