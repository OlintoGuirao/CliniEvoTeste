-- Emagrecimento: trocar campos de medidas para abdomen_superior, cintura, abdomen_inferior, braço, busto
-- Remove: gordura_corporal_percentual, abdomen_cm, quadril_cm
-- Mantém: cintura_cm
-- Adiciona: abdomen_superior_cm, abdomen_inferior_cm, braco_cm, busto_cm

-- 1) Remover campos antigos
DELETE FROM public.procedure_fields pf
USING public.procedures p
WHERE pf.procedure_id = p.id
  AND p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
  AND pf.field_key IN ('gordura_corporal_percentual', 'abdomen_cm', 'quadril_cm');

-- 2) Garantir cintura_cm com sort_order 6
UPDATE public.procedure_fields pf
SET sort_order = 6
FROM public.procedures p
WHERE pf.procedure_id = p.id
  AND p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
  AND pf.field_key = 'cintura_cm';

-- 3) Inserir novos campos de medidas (ordem: abdomen superior 5, cintura 6 já existe, abdomen inferior 7, braço 8, busto 9)
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('abdomen_superior_cm', 'Abdômen superior (cm)', 'number', '[]', 5),
  ('abdomen_inferior_cm', 'Abdômen inferior (cm)', 'number', '[]', 7),
  ('braco_cm', 'Braço (cm)', 'number', '[]', 8),
  ('busto_cm', 'Busto (cm)', 'number', '[]', 9)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;
