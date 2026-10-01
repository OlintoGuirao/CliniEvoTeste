-- Ao aceitar orçamento (budget_quotes.status = accepted),
-- atualiza agendamentos futuros do paciente para clinic_status = 'payment'.

CREATE OR REPLACE FUNCTION public.budget_quote_accept_updates_appointments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'accepted'
     AND NEW.patient_id IS NOT NULL THEN
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

DROP TRIGGER IF EXISTS budget_quote_accept_updates_appointments ON public.budget_quotes;
CREATE TRIGGER budget_quote_accept_updates_appointments
  AFTER UPDATE OF status ON public.budget_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.budget_quote_accept_updates_appointments();

COMMENT ON FUNCTION public.budget_quote_accept_updates_appointments() IS
  'Quando o orçamento muda para accepted, define clinic_status=payment nos agendamentos futuros do paciente (exceto finalizados/cancelados/faltas).';
