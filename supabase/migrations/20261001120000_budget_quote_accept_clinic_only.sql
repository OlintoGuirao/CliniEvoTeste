-- Garante que o aceite de orçamento só altera clinic_status em contas clinic.
-- Idempotente: seguro mesmo se 20260928101000 já tiver a lógica correta.

CREATE OR REPLACE FUNCTION public.budget_quote_accept_updates_appointments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'accepted'
     AND NEW.patient_id IS NOT NULL THEN
    SELECT p.account_type
      INTO v_account_type
    FROM public.profiles p
    WHERE p.id = NEW.professional_id;

    IF v_account_type IS DISTINCT FROM 'clinic' THEN
      RETURN NEW;
    END IF;

    UPDATE public.appointments
    SET
      clinic_status = 'payment',
      updated_at = now()
    WHERE patient_id = NEW.patient_id
      AND appointment_date >= CURRENT_DATE
      AND clinic_status NOT IN (
        'finished',
        'cancelled_by_professional',
        'cancelled_by_patient',
        'no_show'
      );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.budget_quote_accept_updates_appointments() IS
  'Somente clínica: quando o orçamento muda para accepted, define clinic_status=payment nos agendamentos futuros do paciente (exceto finalizados/cancelados/faltas).';
