-- =============================================================================
-- Corrige sessões de procedimento órfãs (sem patient_session / fora da timeline)
-- para o paciente Olinto nas carteiras da Aline e do Juninho.
--
-- O que faz, para cada órfã:
--   1) Se já existir patient_session na mesma data → só vincula
--   2) Se não existir → cria patient_session e vincula
--
-- Rode o SELECT de preview antes do UPDATE/INSERT.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PREVIEW — pacientes Olinto (Aline + Juninho) e órfãs
-- ---------------------------------------------------------------------------
SELECT
  pt.id AS patient_id,
  pf.full_name AS profissional,
  ps.id AS procedure_session_id,
  ps.session_date,
  ps.patient_session_id,
  pr.name AS procedure_name
FROM public.patients pt
JOIN public.profiles pf ON pf.id = pt.professional_id
JOIN public.procedure_instances pi ON pi.patient_id = pt.id
JOIN public.procedures pr ON pr.id = pi.procedure_id
JOIN public.procedure_sessions ps ON ps.procedure_instance_id = pi.id
WHERE pt.full_name ILIKE '%olinto%'
  AND (
    pf.full_name ILIKE '%aline%'
    OR pf.full_name ILIKE '%juninho%'
  )
  AND ps.patient_session_id IS NULL
ORDER BY pf.full_name, ps.session_date DESC;

-- ---------------------------------------------------------------------------
-- EXECUTAR — vincular ou criar timeline para cada órfã
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_patient_session_id uuid;
BEGIN
  FOR r IN
    SELECT
      pt.id AS patient_id,
      pi.professional_id,
      ps.id AS procedure_session_id,
      ps.session_date,
      pf.full_name AS profissional_nome
    FROM public.patients pt
    JOIN public.profiles pf ON pf.id = pt.professional_id
    JOIN public.procedure_instances pi ON pi.patient_id = pt.id
    JOIN public.procedure_sessions ps ON ps.procedure_instance_id = pi.id
    WHERE pt.full_name ILIKE '%olinto%'
      AND (
        pf.full_name ILIKE '%aline%'
        OR pf.full_name ILIKE '%juninho%'
      )
      AND ps.patient_session_id IS NULL
    ORDER BY pf.full_name, ps.session_date
  LOOP
    SELECT pss.id
    INTO v_patient_session_id
    FROM public.patient_sessions pss
    WHERE pss.patient_id = r.patient_id
      AND pss.session_date = r.session_date
    ORDER BY pss.created_at
    LIMIT 1;

    IF v_patient_session_id IS NULL THEN
      INSERT INTO public.patient_sessions (
        patient_id,
        professional_id,
        session_date
      )
      VALUES (
        r.patient_id,
        r.professional_id,
        r.session_date
      )
      RETURNING id INTO v_patient_session_id;

      RAISE NOTICE '[%] Criou patient_session % para %',
        r.profissional_nome, v_patient_session_id, r.session_date;
    ELSE
      RAISE NOTICE '[%] Reutilizou patient_session % para %',
        r.profissional_nome, v_patient_session_id, r.session_date;
    END IF;

    UPDATE public.procedure_sessions
    SET patient_session_id = v_patient_session_id,
        updated_at = now()
    WHERE id = r.procedure_session_id;

    RAISE NOTICE '[%] Vinculou procedure_session % → patient_session %',
      r.profissional_nome, r.procedure_session_id, v_patient_session_id;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- CONFERIR — contagens devem bater (12 = 12) em cada carteira
-- ---------------------------------------------------------------------------
SELECT
  pf.full_name AS profissional,
  pt.full_name AS paciente,
  (SELECT COUNT(*) FROM public.patient_sessions pss WHERE pss.patient_id = pt.id) AS timeline,
  (SELECT COUNT(*)
   FROM public.procedure_sessions ps2
   JOIN public.procedure_instances pi2 ON pi2.id = ps2.procedure_instance_id
   WHERE pi2.patient_id = pt.id) AS procedure_sessions,
  (SELECT COUNT(*)
   FROM public.procedure_sessions ps2
   JOIN public.procedure_instances pi2 ON pi2.id = ps2.procedure_instance_id
   WHERE pi2.patient_id = pt.id
     AND ps2.patient_session_id IS NULL) AS orphans_restantes
FROM public.patients pt
JOIN public.profiles pf ON pf.id = pt.professional_id
WHERE pt.full_name ILIKE '%olinto%'
  AND (
    pf.full_name ILIKE '%aline%'
    OR pf.full_name ILIKE '%juninho%'
  )
ORDER BY pf.full_name;
