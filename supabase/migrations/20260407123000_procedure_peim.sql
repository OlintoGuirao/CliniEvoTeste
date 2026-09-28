-- Procedimento global: PEIM (secagem de microvasos)
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT gen_random_uuid(), true, NULL, 'Injetáveis', 'PEIM', 'Procedimento estético para tratamento de microvasos.', 'peim', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p
  WHERE p.slug = 'peim' AND p.is_global = true
);

INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('queixa_principal', 'Queixa principal', 'text', '[]', 1),
  ('regiao_tratada', 'Região tratada (pernas, coxa, panturrilha)', 'text', '[]', 2),
  ('quantidade_microvasos', 'Quantidade de microvasos (estimativa)', 'number', '[]', 3),
  ('classificacao_vasos', 'Classificação dos vasos', 'select', '["telangiectasia","reticular","outros"]', 4),
  ('cor_vasos', 'Cor dos vasos', 'select', '["vermelho","roxo","azul"]', 5),
  ('uso_medicamentos', 'Uso de medicamentos', 'text', '[]', 6),
  ('contraindicacoes', 'Contraindicações', 'select_multi', '["gestação","lactação","trombose","alergia","diabetes descompensada","outros"]', 7),
  ('substancia_utilizada', 'Substância utilizada', 'select', '["glicose 50%","glicose 75%","outra"]', 8),
  ('concentracao', 'Concentração', 'text', '[]', 9),
  ('volume_total_ml', 'Volume total (ml)', 'number', '[]', 10),
  ('quantidade_aplicacoes', 'Quantidade de aplicações', 'number', '[]', 11),
  ('tecnica_utilizada', 'Técnica utilizada', 'select', '["injeção direta","espuma","mista"]', 12),
  ('uso_anestesia', 'Uso de anestesia', 'boolean', '[]', 13),
  ('tipo_anestesia', 'Tipo de anestesia', 'text', '[]', 14),
  ('tempo_procedimento_min', 'Tempo do procedimento (min)', 'number', '[]', 15),
  ('equipamentos_utilizados', 'Equipamentos utilizados', 'text', '[]', 16)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'peim' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO UPDATE
SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  options = EXCLUDED.options,
  sort_order = EXCLUDED.sort_order;
