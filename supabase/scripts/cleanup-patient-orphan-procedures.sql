-- Limpeza: procedimentos ativos sem nenhuma sessão (órfãos após apagar da timeline)
-- Paciente: 75b5336c-91a1-47ed-8af3-1fee13c88383
-- Executar no Supabase → SQL Editor (rode o SELECT antes do DELETE)

-- 1) Conferir o que será removido
SELECT
  pi.id AS instance_id,
  pi.status,
  pi.data_inicio,
  p.name AS procedure_name,
  p.slug,
  (SELECT COUNT(*) FROM public.procedure_sessions ps WHERE ps.procedure_instance_id = pi.id) AS session_count
FROM public.procedure_instances pi
JOIN public.procedures p ON p.id = pi.procedure_id
WHERE pi.patient_id = '75b5336c-91a1-47ed-8af3-1fee13c88383'
  AND NOT EXISTS (
    SELECT 1
    FROM public.procedure_sessions ps
    WHERE ps.procedure_instance_id = pi.id
  )
ORDER BY pi.data_inicio DESC;

-- 2) Remover lembretes de botox ligados a essas instâncias (FK SET NULL; limpamos antes por segurança)
DELETE FROM public.botox_reapplication_reminders br
WHERE br.procedure_instance_id IN (
  SELECT pi.id
  FROM public.procedure_instances pi
  WHERE pi.patient_id = '75b5336c-91a1-47ed-8af3-1fee13c88383'
    AND NOT EXISTS (
      SELECT 1 FROM public.procedure_sessions ps WHERE ps.procedure_instance_id = pi.id
    )
);

-- 3) Apagar instâncias sem sessão (fotos, resultados e links públicos caem em CASCADE)
DELETE FROM public.procedure_instances pi
WHERE pi.patient_id = '75b5336c-91a1-47ed-8af3-1fee13c88383'
  AND NOT EXISTS (
    SELECT 1 FROM public.procedure_sessions ps WHERE ps.procedure_instance_id = pi.id
  );

-- 4) Conferir o que ainda resta em "Procedimentos ativos"
SELECT
  pi.id,
  pi.status,
  p.name,
  (SELECT COUNT(*) FROM public.procedure_sessions ps WHERE ps.procedure_instance_id = pi.id) AS session_count
FROM public.procedure_instances pi
JOIN public.procedures p ON p.id = pi.procedure_id
WHERE pi.patient_id = '75b5336c-91a1-47ed-8af3-1fee13c88383'
  AND pi.status = 'em_andamento'
ORDER BY pi.data_inicio DESC;

-- ---------------------------------------------------------------------------
-- OPCIONAL: se ainda aparecer procedimento COM sessões que você já tirou da timeline,
-- confira se sobrou procedure_session sem patient_session (dado antigo / apagado só na UI):
--
-- SELECT ps.id, ps.session_date, ps.patient_session_id, p.name
-- FROM public.procedure_sessions ps
-- JOIN public.procedure_instances pi ON pi.id = ps.procedure_instance_id
-- JOIN public.procedures p ON p.id = pi.procedure_id
-- WHERE pi.patient_id = '75b5336c-91a1-47ed-8af3-1fee13c88383'
-- ORDER BY ps.session_date DESC;
--
-- Para apagar UMA instância específica (substitua o UUID):
-- DELETE FROM public.botox_reapplication_reminders WHERE procedure_instance_id = 'INSTANCE_ID';
-- DELETE FROM public.procedure_instances WHERE id = 'INSTANCE_ID' AND patient_id = '75b5336c-91a1-47ed-8af3-1fee13c88383';
-- (procedure_sessions e fotos caem em CASCADE)
-- ---------------------------------------------------------------------------
