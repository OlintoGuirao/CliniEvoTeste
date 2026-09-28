-- Novos procedimentos estéticos (padrão Botox/Emagrecimento: telas genéricas com procedure_fields)
-- Insere apenas se não existir procedimento global com o mesmo slug

INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT v.id, v.is_global, v.created_by, v.category, v.name, v.description, v.slug, v.is_active
FROM (VALUES
  ('b1000000-0000-4000-8000-000000000001'::uuid, true, NULL::uuid, 'ESTÉTICA FACIAL', 'Microagulhamento', 'Microagulhamento: agulha, região, ativos', 'microagulhamento', true),
  ('b1000000-0000-4000-8000-000000000002'::uuid, true, NULL::uuid, 'ESTÉTICA FACIAL', 'Peeling', 'Peeling: tipo de ácido, concentração, camadas', 'peeling', true),
  ('b1000000-0000-4000-8000-000000000003'::uuid, true, NULL::uuid, 'TECNOLOGIAS ESTÉTICAS', 'Ultrassom microfocado', 'Ultrassom microfocado: região, parâmetros, sessões', 'ultrassom-microfocado', true),
  ('b1000000-0000-4000-8000-000000000004'::uuid, true, NULL::uuid, 'TECNOLOGIAS ESTÉTICAS', 'Endolaser', 'Endolaser: região, parâmetros, aplicação', 'endolaser', true),
  ('b1000000-0000-4000-8000-000000000005'::uuid, true, NULL::uuid, 'ESTÉTICA FACIAL', 'Fios de PDO', 'Fios de PDO: região, quantidade, técnica', 'fios-pdo', true),
  ('b1000000-0000-4000-8000-000000000006'::uuid, true, NULL::uuid, 'ESTÉTICA FACIAL', 'Bioestimulador de colágeno', 'Bioestimulador de colágeno: produto, região, sessões', 'bioestimulador-colageno', true),
  ('b1000000-0000-4000-8000-000000000007'::uuid, true, NULL::uuid, 'ESTÉTICA FACIAL', 'Lipo de papada enzimática', 'Lipo enzimática de papada', 'lipo-papada-enzimatica', true),
  ('b1000000-0000-4000-8000-000000000008'::uuid, true, NULL::uuid, 'ESTÉTICA CORPORAL', 'Lipo enzimática gordura localizada', 'Lipo enzimática: abdômen, flanco, braço, culote', 'lipo-enzimatica-gordura-localizada', true),
  ('b1000000-0000-4000-8000-000000000009'::uuid, true, NULL::uuid, 'ESTÉTICA CORPORAL', 'Acelerador metabólico', 'Acelerador metabólico: protocolo, região, sessões', 'acelerador-metabolico', true),
  ('b1000000-0000-4000-8000-000000000010'::uuid, true, NULL::uuid, 'ESTÉTICA CORPORAL', 'Harmonização glútea', 'Harmonização glútea: produto, técnica, volume', 'harmonizacao-glutea', true)
) AS v(id, is_global, created_by, category, name, description, slug, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p
  WHERE p.slug = v.slug AND p.is_global = true AND p.created_by IS NULL
);

-- procedure_fields para cada novo procedimento (padrão: região, produto/parâmetros, observações, fotos)

-- Microagulhamento
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('regiao', 'Região', 'text', '[]', 1),
  ('tipo_agulha', 'Tipo de agulha', 'text', '[]', 2),
  ('ativos_utilizados', 'Ativos utilizados', 'text', '[]', 3),
  ('observacoes', 'Observações', 'text', '[]', 4),
  ('foto_evolucao', 'Foto evolução', 'image', '[]', 5)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'microagulhamento' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Peeling
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('tipo_acido', 'Tipo de ácido', 'text', '[]', 1),
  ('concentracao', 'Concentração', 'text', '[]', 2),
  ('regiao', 'Região', 'text', '[]', 3),
  ('camadas', 'Camadas', 'number', '[]', 4),
  ('foto_evolucao', 'Foto evolução', 'image', '[]', 5)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'peeling' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Ultrassom microfocado
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('regiao', 'Região', 'text', '[]', 1),
  ('parametros', 'Parâmetros', 'text', '[]', 2),
  ('numero_sessao', 'Número da sessão', 'number', '[]', 3),
  ('observacoes', 'Observações', 'text', '[]', 4),
  ('foto_evolucao', 'Foto evolução', 'image', '[]', 5)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'ultrassom-microfocado' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Endolaser
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('regiao', 'Região', 'text', '[]', 1),
  ('parametros', 'Parâmetros', 'text', '[]', 2),
  ('observacoes', 'Observações', 'text', '[]', 3),
  ('foto_evolucao', 'Foto evolução', 'image', '[]', 4)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'endolaser' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Fios de PDO
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('regiao', 'Região', 'text', '[]', 1),
  ('quantidade_fios', 'Quantidade de fios', 'number', '[]', 2),
  ('tecnica', 'Técnica', 'text', '[]', 3),
  ('observacoes', 'Observações', 'text', '[]', 4),
  ('foto_evolucao', 'Foto evolução', 'image', '[]', 5)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'fios-pdo' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Bioestimulador de colágeno
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('produto', 'Produto', 'text', '[]', 1),
  ('regiao', 'Região', 'text', '[]', 2),
  ('quantidade_ml', 'Quantidade (ml)', 'number', '[]', 3),
  ('numero_sessao', 'Número da sessão', 'number', '[]', 4),
  ('foto_evolucao', 'Foto evolução', 'image', '[]', 5)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'bioestimulador-colageno' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Lipo de papada enzimática
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('produto_utilizado', 'Produto utilizado', 'text', '[]', 1),
  ('quantidade_ml', 'Quantidade (ml)', 'number', '[]', 2),
  ('observacoes', 'Observações', 'text', '[]', 3),
  ('foto_evolucao', 'Foto evolução', 'image', '[]', 4)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'lipo-papada-enzimatica' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Lipo enzimática gordura localizada
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('regiao', 'Região (abdômen, flanco, braço, culote)', 'text', '[]', 1),
  ('produto_utilizado', 'Produto utilizado', 'text', '[]', 2),
  ('quantidade_ml', 'Quantidade (ml)', 'number', '[]', 3),
  ('observacoes', 'Observações', 'text', '[]', 4),
  ('foto_evolucao', 'Foto evolução', 'image', '[]', 5)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'lipo-enzimatica-gordura-localizada' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Acelerador metabólico
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('regiao', 'Região', 'text', '[]', 1),
  ('protocolo', 'Protocolo', 'text', '[]', 2),
  ('numero_sessao', 'Número da sessão', 'number', '[]', 3),
  ('observacoes', 'Observações', 'text', '[]', 4),
  ('foto_evolucao', 'Foto evolução', 'image', '[]', 5)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'acelerador-metabolico' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Harmonização glútea
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('produto', 'Produto', 'text', '[]', 1),
  ('tecnica', 'Técnica', 'text', '[]', 2),
  ('volume_ml', 'Volume (ml)', 'number', '[]', 3),
  ('observacoes', 'Observações', 'text', '[]', 4),
  ('foto_evolucao', 'Foto evolução', 'image', '[]', 5)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'harmonizacao-glutea' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;
</think>
Corrigindo typo no slug na migration e adicionando os procedure_fields.
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
StrReplace