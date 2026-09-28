-- Corrigir search_path nas funções que faltaram
CREATE OR REPLACE FUNCTION public.is_patient_owner(_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE id = _patient_id
      AND professional_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.has_lgpd_consent(_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT consent_given 
     FROM public.lgpd_consents 
     WHERE patient_id = _patient_id),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.calculate_bmi(_weight DECIMAL, _height DECIMAL)
RETURNS DECIMAL
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _height > 0 THEN ROUND(_weight / (_height * _height), 2)
    ELSE NULL
  END
$$;