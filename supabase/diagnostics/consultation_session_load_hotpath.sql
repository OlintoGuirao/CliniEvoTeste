-- =============================================================================
-- Hot path: ConsultationSessionPage.loadData → patient_sessions (últimas 5 + embed)
-- Código: src/pages/ConsultationSessionPage.tsx (Promise.all inicial)
-- =============================================================================
--
-- [capture-network] PostgREST (DevTools → Network → filtrar rest/v1)
--
-- Método: abrir Nova consulta / Consulta com um patientId; ordenar por Time;
-- abrir GET patient_sessions e anotar:
--   • Waiting (TTFB)  → latência servidor (Postgres + RLS + joins do embed)
--   • Content Download → tamanho do payload JSON (procedure_instances + procedures)
--
-- URL típica (substituir HOST, PATIENT_UUID, JWT anon):
--
--   GET https://HOST/rest/v1/patient_sessions
--     ?select=id,session_date,observacoes,
--       procedure_sessions(
--         id,
--         procedure_instance_id,
--         procedure_instances(procedures(name,slug))
--       )
--     &patient_id=eq.PATIENT_UUID
--     &order=session_date.desc
--     &limit=5
--
-- Cabeçalhos: apikey: <anon>, Authorization: Bearer <anon>
--
-- =============================================================================
-- [explain-sql] Equivalente ao “top 5 sessões + joins do embed” (sem RLS;
-- no SQL Editor como postgres/service_role o plano pode diferir do cliente anon)
--
-- Paciente usado no EXPLAIN (escolhe um dos dois):
--   A) Padrão abaixo: primeiro id em public.patients (UUID válido sem colar nada).
--   B) Paciente fixo: substitua o CTE target_patient por um único valor, ex.:
--        WITH target_patient AS (SELECT 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid AS id),
-- =============================================================================

EXPLAIN (ANALYZE, BUFFERS)
WITH target_patient AS (
  SELECT id FROM public.patients LIMIT 1
),
top_ps AS (
  SELECT ps.id, ps.session_date, ps.observacoes
  FROM public.patient_sessions ps
  INNER JOIN target_patient tp ON tp.id = ps.patient_id
  ORDER BY ps.session_date DESC
  LIMIT 5
)
SELECT
  ps.id,
  ps.session_date,
  ps.observacoes,
  prs.id AS procedure_session_id,
  prs.procedure_instance_id,
  pr.name AS procedure_name,
  pr.slug AS procedure_slug
FROM top_ps ps
LEFT JOIN public.procedure_sessions prs ON prs.patient_session_id = ps.id
LEFT JOIN public.procedure_instances pi ON pi.id = prs.procedure_instance_id
LEFT JOIN public.procedures pr ON pr.id = pi.procedure_id;
