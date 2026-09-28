-- Adiciona campo Altura (cm) ao procedimento Emagrecimento e reordena para IMC = peso / (altura_m)²
-- IMC será calculado no frontend a partir de peso (kg) e altura (cm).
-- Usa slug para achar o procedimento (não assume UUID fixo).

-- 0) Garantir que o procedimento "Emagrecimento" existe (mesmo que seed/migração anterior tenha falhado)
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT
    'a1000000-0000-4000-8000-000000000001'::uuid,
    true,
    NULL,
    'ESTÉTICA CORPORAL',
    'Emagrecimento / Redução de Medidas',
    'Controle de peso, IMC, medidas e fotos antes/depois',
    'emagrecimento-reducao-medidas',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM public.procedures
    WHERE slug = 'emagrecimento-reducao-medidas' AND is_global = true
);

-- 1) Inserir campo altura_cm com sort_order 2 (entre peso_inicial e peso_atual)
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT
    p.id,
    'altura_cm',
    'Altura (cm)',
    'number',
    '[]',
    2
FROM public.procedures p
WHERE p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
LIMIT 1
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- 2) Reordenar: peso_atual -> 3, imc -> 4, gordura_corporal_percentual -> 5, ...
UPDATE public.procedure_fields pf
SET sort_order = 3
FROM public.procedures p
WHERE pf.procedure_id = p.id AND p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
  AND pf.field_key = 'peso_atual';

UPDATE public.procedure_fields pf
SET sort_order = 4
FROM public.procedures p
WHERE pf.procedure_id = p.id AND p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
  AND pf.field_key = 'imc';

UPDATE public.procedure_fields pf
SET sort_order = 5
FROM public.procedures p
WHERE pf.procedure_id = p.id AND p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
  AND pf.field_key = 'gordura_corporal_percentual';

UPDATE public.procedure_fields pf
SET sort_order = 6
FROM public.procedures p
WHERE pf.procedure_id = p.id AND p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
  AND pf.field_key = 'cintura_cm';

UPDATE public.procedure_fields pf
SET sort_order = 7
FROM public.procedures p
WHERE pf.procedure_id = p.id AND p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
  AND pf.field_key = 'abdomen_cm';

UPDATE public.procedure_fields pf
SET sort_order = 8
FROM public.procedures p
WHERE pf.procedure_id = p.id AND p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
  AND pf.field_key = 'quadril_cm';

UPDATE public.procedure_fields pf
SET sort_order = 9
FROM public.procedures p
WHERE pf.procedure_id = p.id AND p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
  AND pf.field_key = 'fotos_antes_depois';
