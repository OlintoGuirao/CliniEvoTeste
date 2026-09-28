-- Recupera recebimentos de atendimentos salão já finalizados (antes do insert automático)
WITH parsed AS (
  SELECT
    ps.id AS patient_session_id,
    ps.patient_id,
    ps.professional_id,
    ps.session_date,
    ps.start_time,
    (regexp_match(ps.observacoes, 'salon_procedure:([0-9a-f-]{36})', 'i'))[1]::uuid AS salon_procedure_id,
    (regexp_match(ps.observacoes, 'Valor:\s*R\$\s*([0-9]+),([0-9]{2})\s*\((\w+)\)', 'i')) AS valor_match
  FROM public.patient_sessions ps
  WHERE ps.observacoes ~* 'salon_procedure:'
    AND ps.observacoes ~* 'Valor:\s*R\$'
    AND NOT EXISTS (
      SELECT 1 FROM public.recebimentos r WHERE r.patient_session_id = ps.id
    )
)
INSERT INTO public.recebimentos (
  cliente_id,
  profissional_id,
  salon_procedure_id,
  patient_session_id,
  valor_total,
  valor_recebido,
  forma_pagamento,
  parcelas,
  status,
  data
)
SELECT
  p.patient_id,
  p.professional_id,
  p.salon_procedure_id,
  p.patient_session_id,
  (p.valor_match[1]::text || '.' || p.valor_match[2]::text)::numeric,
  (p.valor_match[1]::text || '.' || p.valor_match[2]::text)::numeric,
  CASE lower(p.valor_match[3])
    WHEN 'cartao' THEN 'cartao'
    WHEN 'cartão' THEN 'cartao'
    WHEN 'dinheiro' THEN 'dinheiro'
    ELSE 'pix'
  END,
  NULL,
  'pago',
  (p.session_date::text || 'T' || COALESCE(left(p.start_time::text, 8), '00:00:00'))::timestamptz
FROM parsed p
WHERE p.salon_procedure_id IS NOT NULL
  AND p.valor_match IS NOT NULL;
