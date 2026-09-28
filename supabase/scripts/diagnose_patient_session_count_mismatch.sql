-- =============================================================================
-- Diagnóstico: diferença entre timeline (patient_sessions) e card do procedimento
-- (procedure_sessions por instância).
--
-- Uso no SQL Editor do Supabase:
--   1) Ajuste o filtro do paciente abaixo (nome ou UUID)
--   2) Rode bloco por bloco ou o arquivo inteiro
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Identificar o paciente
-- ---------------------------------------------------------------------------
-- Troque o ILIKE ou use o UUID direto em v_patient_id
/*
SELECT id, full_name, phone, professional_id
FROM public.patients
WHERE full_name ILIKE '%olinto%'
ORDER BY full_name;
*/

-- ---------------------------------------------------------------------------
-- Parâmetros (edite aqui)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_patient_id uuid;
BEGIN
  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE full_name ILIKE '%olinto%'   -- ← ajuste o nome
  ORDER BY created_at
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado. Ajuste o filtro ILIKE ou use o UUID abaixo.';
  END IF;

  RAISE NOTICE 'patient_id = %', v_patient_id;
END $$;

-- Para usar UUID fixo, descomente e substitua:
-- \set patient_id '00000000-0000-0000-0000-000000000000'

-- ---------------------------------------------------------------------------
-- 1) Resumo rápido (contagens)
-- ---------------------------------------------------------------------------
WITH p AS (
  SELECT id
  FROM public.patients
  WHERE full_name ILIKE '%olinto%'   -- ← ajuste
  ORDER BY created_at
  LIMIT 1
),
inst AS (
  SELECT pi.id, pi.procedure_id, pi.status, pi.data_inicio, pr.name AS procedure_name
  FROM public.procedure_instances pi
  JOIN p ON p.id = pi.patient_id
  JOIN public.procedures pr ON pr.id = pi.procedure_id
)
SELECT
  (SELECT COUNT(*) FROM public.patient_sessions ps JOIN p ON p.id = ps.patient_id) AS patient_sessions_timeline,
  (SELECT COUNT(*)
   FROM public.procedure_sessions ps2
   JOIN inst i ON i.id = ps2.procedure_instance_id) AS procedure_sessions_total,
  (SELECT COUNT(*)
   FROM public.procedure_sessions ps2
   JOIN inst i ON i.id = ps2.procedure_instance_id
   WHERE ps2.patient_session_id IS NULL) AS procedure_sessions_sem_patient_session,
  (SELECT COUNT(*)
   FROM public.patient_sessions ps
   JOIN p ON p.id = ps.patient_id
   WHERE NOT EXISTS (
     SELECT 1 FROM public.procedure_sessions ps2 WHERE ps2.patient_session_id = ps.id
   )) AS patient_sessions_sem_procedure_session;

-- ---------------------------------------------------------------------------
-- 2) Por procedimento / instância (o que alimenta o card "X sessões realizadas")
-- ---------------------------------------------------------------------------
SELECT
  pi.id AS instance_id,
  pr.name AS procedure_name,
  pi.status,
  COUNT(ps.id) AS procedure_sessions_count,
  COUNT(ps.id) FILTER (WHERE ps.patient_session_id IS NULL) AS orphans_no_patient_session,
  COUNT(DISTINCT ps.patient_session_id) FILTER (WHERE ps.patient_session_id IS NOT NULL) AS linked_patient_sessions
FROM public.patients pt
JOIN public.procedure_instances pi ON pi.patient_id = pt.id
JOIN public.procedures pr ON pr.id = pi.procedure_id
LEFT JOIN public.procedure_sessions ps ON ps.procedure_instance_id = pi.id
WHERE pt.full_name ILIKE '%olinto%'   -- ← ajuste
GROUP BY pi.id, pr.name, pi.status
ORDER BY procedure_sessions_count DESC;

-- ---------------------------------------------------------------------------
-- 3) EXTRA — procedure_sessions órfãs (provável causa do +1 no card)
--    Registros que entram no card mas NÃO aparecem na timeline
-- ---------------------------------------------------------------------------
SELECT
  ps.id AS procedure_session_id,
  ps.session_date,
  ps.created_at,
  ps.patient_session_id,
  pi.id AS procedure_instance_id,
  pr.name AS procedure_name,
  ps.observacoes
FROM public.patients pt
JOIN public.procedure_instances pi ON pi.patient_id = pt.id
JOIN public.procedures pr ON pr.id = pi.procedure_id
JOIN public.procedure_sessions ps ON ps.procedure_instance_id = pi.id
WHERE pt.full_name ILIKE '%olinto%'   -- ← ajuste
  AND ps.patient_session_id IS NULL
ORDER BY ps.session_date DESC, ps.created_at DESC;

-- ---------------------------------------------------------------------------
-- 4) Timeline (patient_sessions) — o que alimenta chip "11 realizadas"
-- ---------------------------------------------------------------------------
SELECT
  ps.id AS patient_session_id,
  ps.session_date,
  ps.created_at,
  ps.observacoes,
  COUNT(proc.id) AS procedure_sessions_linked,
  string_agg(DISTINCT pr.name, ' · ' ORDER BY pr.name) AS procedures
FROM public.patients pt
JOIN public.patient_sessions ps ON ps.patient_id = pt.id
LEFT JOIN public.procedure_sessions proc ON proc.patient_session_id = ps.id
LEFT JOIN public.procedure_instances pi ON pi.id = proc.procedure_instance_id
LEFT JOIN public.procedures pr ON pr.id = pi.procedure_id
WHERE pt.full_name ILIKE '%olinto%'   -- ← ajuste
GROUP BY ps.id, ps.session_date, ps.created_at, ps.observacoes
ORDER BY ps.session_date DESC, ps.created_at DESC;

-- ---------------------------------------------------------------------------
-- 5) Dias com mais de 1 procedure_session na MESMA instância
--    (outra causa possível de card > timeline)
-- ---------------------------------------------------------------------------
SELECT
  ps.procedure_instance_id,
  pr.name AS procedure_name,
  ps.session_date,
  COUNT(*) AS sessions_same_day,
  array_agg(ps.id ORDER BY ps.created_at) AS procedure_session_ids,
  array_agg(ps.patient_session_id::text ORDER BY ps.created_at) AS patient_session_ids
FROM public.patients pt
JOIN public.procedure_instances pi ON pi.patient_id = pt.id
JOIN public.procedures pr ON pr.id = pi.procedure_id
JOIN public.procedure_sessions ps ON ps.procedure_instance_id = pi.id
WHERE pt.full_name ILIKE '%olinto%'   -- ← ajuste
GROUP BY ps.procedure_instance_id, pr.name, ps.session_date
HAVING COUNT(*) > 1
ORDER BY ps.session_date DESC;

-- ---------------------------------------------------------------------------
-- 6) Comparativo lado a lado (timeline vs registros soltos)
-- ---------------------------------------------------------------------------
WITH p AS (
  SELECT id FROM public.patients
  WHERE full_name ILIKE '%olinto%'   -- ← ajuste
  LIMIT 1
)
SELECT 'timeline' AS origem, ps.id AS registro_id, ps.session_date::text AS data, NULL::uuid AS procedure_instance_id
FROM public.patient_sessions ps
JOIN p ON p.id = ps.patient_id

UNION ALL

SELECT
  'procedure_session' AS origem,
  ps.id,
  ps.session_date::text,
  ps.procedure_instance_id
FROM public.procedure_sessions ps
JOIN public.procedure_instances pi ON pi.id = ps.procedure_instance_id
JOIN p ON p.id = pi.patient_id

ORDER BY data DESC, origem;
