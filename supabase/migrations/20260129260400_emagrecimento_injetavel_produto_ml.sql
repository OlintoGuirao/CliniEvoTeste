-- Emagrecimento: campo Injetável (Sim/Não) e condicionais Produto usado e mg
-- produto_usado e mg são exibidos apenas quando Injetável = Sim (lógica no frontend).

-- 1) Injetável (select Sim/Não)
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT
  p.id,
  'injetavel',
  'Injetável',
  'select',
  '["Não", "Sim"]'::jsonb,
  10
FROM public.procedures p
WHERE p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
LIMIT 1
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- 2) Produto usado (texto) — exibido só quando Injetável = Sim
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT
  p.id,
  'produto_usado',
  'Produto usado',
  'text',
  '[]'::jsonb,
  11
FROM public.procedures p
WHERE p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
LIMIT 1
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- 3) mg (número) — exibido só quando Injetável = Sim (field_key = ml para compatibilidade)
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT
  p.id,
  'ml',
  'mg',
  'number',
  '[]'::jsonb,
  12
FROM public.procedures p
WHERE p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
LIMIT 1
ON CONFLICT (procedure_id, field_key) DO UPDATE SET label = 'mg';
