-- Remove campos de quantidade/intervalo de sessões da Terapia Capilar
DELETE FROM public.procedure_fields pf
USING public.procedures p
WHERE pf.procedure_id = p.id
  AND p.slug = 'terapia-capilar'
  AND p.is_global = true
  AND pf.field_key IN ('quantidade_sessoes', 'intervalo_entre_sessoes');
