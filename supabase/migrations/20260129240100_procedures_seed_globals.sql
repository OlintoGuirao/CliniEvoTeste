-- Seed: procedimentos estéticos globais e seus campos dinâmicos
-- Procedimentos globais: is_global = true, created_by = NULL
-- Insere apenas se não existir procedimento global com o mesmo slug (não depende do nome da constraint)

INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT v.id, v.is_global, v.created_by, v.category, v.name, v.description, v.slug, v.is_active
FROM (VALUES
  ('a1000000-0000-4000-8000-000000000001'::uuid, true, NULL::uuid, 'ESTÉTICA CORPORAL', 'Emagrecimento / Redução de Medidas', 'Controle de peso, IMC, medidas e fotos antes/depois', 'emagrecimento-reducao-medidas', true),
  ('a1000000-0000-4000-8000-000000000002'::uuid, true, NULL::uuid, 'ESTÉTICA CORPORAL', 'Drenagem Linfática', 'Drenagem linfática: tipo, região, edema, duração', 'drenagem-linfatica', true),
  ('a1000000-0000-4000-8000-000000000003'::uuid, true, NULL::uuid, 'ESTÉTICA CORPORAL', 'Criolipólise', 'Criolipólise: área, temperatura, tempo, sessões', 'criolipolise', true),
  ('a1000000-0000-4000-8000-000000000004'::uuid, true, NULL::uuid, 'ESTÉTICA CORPORAL', 'Radiofrequência Corporal', 'RF corporal: região, potência, tempo, grau de flacidez', 'radiofrequencia-corporal', true),
  ('a1000000-0000-4000-8000-000000000005'::uuid, true, NULL::uuid, 'ESTÉTICA CORPORAL', 'Ultrassom Cavitacional', 'Ultrassom cavitacional: região, intensidade, medidas', 'ultrassom-cavitacional', true),
  ('a1000000-0000-4000-8000-000000000006'::uuid, true, NULL::uuid, 'ESTÉTICA CORPORAL', 'Endermologia', 'Endermologia: região, frequência, objetivo, intensidade', 'endermologia', true),
  ('a2000000-0000-4000-8000-000000000001'::uuid, true, NULL::uuid, 'ESTÉTICA FACIAL', 'Botox (Toxina Botulínica)', 'Aplicação de toxina botulínica', 'botox', true),
  ('a2000000-0000-4000-8000-000000000002'::uuid, true, NULL::uuid, 'ESTÉTICA FACIAL', 'Preenchimento Facial', 'Preenchimento com ácido hialurônico', 'preenchimento-facial', true),
  ('a2000000-0000-4000-8000-000000000003'::uuid, true, NULL::uuid, 'ESTÉTICA FACIAL', 'Limpeza de Pele', 'Limpeza de pele: tipo, extrações, produtos', 'limpeza-de-pele', true),
  ('a2000000-0000-4000-8000-000000000004'::uuid, true, NULL::uuid, 'ESTÉTICA FACIAL', 'Peeling Químico', 'Peeling: tipo de ácido, concentração, camadas', 'peeling-quimico', true),
  ('a2000000-0000-4000-8000-000000000005'::uuid, true, NULL::uuid, 'ESTÉTICA FACIAL', 'Microagulhamento Facial', 'Microagulhamento: agulha, região, ativos', 'microagulhamento-facial', true),
  ('a2000000-0000-4000-8000-000000000006'::uuid, true, NULL::uuid, 'ESTÉTICA FACIAL', 'Skinbooster', 'Skinbooster: produto, região, hidratação', 'skinbooster', true),
  ('a3000000-0000-4000-8000-000000000001'::uuid, true, NULL::uuid, 'ESTÉTICA CAPILAR', 'Tratamento Capilar', 'Tratamento capilar: queixa, região, diagnóstico', 'tratamento-capilar', true),
  ('a3000000-0000-4000-8000-000000000002'::uuid, true, NULL::uuid, 'ESTÉTICA CAPILAR', 'Microagulhamento Capilar', 'Microagulhamento no couro cabeludo', 'microagulhamento-capilar', true),
  ('a3000000-0000-4000-8000-000000000003'::uuid, true, NULL::uuid, 'ESTÉTICA CAPILAR', 'PRP Capilar', 'PRP capilar: volume, área, sessões', 'prp-capilar', true),
  ('a4000000-0000-4000-8000-000000000001'::uuid, true, NULL::uuid, 'TECNOLOGIAS ESTÉTICAS', 'Laser / Luz Pulsada', 'Laser e luz pulsada: equipamento, parâmetros, região', 'laser-luz-pulsada', true),
  ('a4000000-0000-4000-8000-000000000002'::uuid, true, NULL::uuid, 'TECNOLOGIAS ESTÉTICAS', 'Depilação a Laser', 'Depilação: região, fototipo, potência, sessões', 'depilacao-laser', true),
  ('a4000000-0000-4000-8000-000000000003'::uuid, true, NULL::uuid, 'TECNOLOGIAS ESTÉTICAS', 'LED Terapia', 'LED: cor, objetivo, tempo de exposição', 'led-terapia', true),
  ('a5000000-0000-4000-8000-000000000001'::uuid, true, NULL::uuid, 'REJUVENESCIMENTO / PELE', 'Rejuvenescimento Facial', 'Rejuvenescimento: técnica, regiões, avaliação', 'rejuvenescimento-facial', true),
  ('a5000000-0000-4000-8000-000000000002'::uuid, true, NULL::uuid, 'REJUVENESCIMENTO / PELE', 'Tratamento de Acne', 'Acne: grau, regiões, produtos', 'tratamento-acne', true),
  ('a5000000-0000-4000-8000-000000000003'::uuid, true, NULL::uuid, 'REJUVENESCIMENTO / PELE', 'Tratamento de Manchas (Melasma)', 'Manchas: tipo, regiões, protocolo', 'tratamento-manchas', true),
  ('a6000000-0000-4000-8000-000000000001'::uuid, true, NULL::uuid, 'MASSOTERAPIA / BEM-ESTAR', 'Massagem Relaxante', 'Massagem relaxante: duração, regiões, queixa', 'massagem-relaxante', true),
  ('a6000000-0000-4000-8000-000000000002'::uuid, true, NULL::uuid, 'MASSOTERAPIA / BEM-ESTAR', 'Massagem Modeladora', 'Massagem modeladora: regiões, intensidade, objetivo', 'massagem-modeladora', true)
) AS v(id, is_global, created_by, category, name, description, slug, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p
  WHERE p.slug = v.slug AND p.is_global = true AND p.created_by IS NULL
);

-- procedure_fields: campos dinâmicos por procedimento (exemplos por categoria)
-- Emagrecimento: procedure_id obtido por slug (procedimento pode ter sido criado por outra migração com outro id)
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('peso_inicial', 'Peso inicial (kg)', 'number', '[]', 1),
  ('altura_cm', 'Altura (cm)', 'number', '[]', 2),
  ('peso_atual', 'Peso atual (kg)', 'number', '[]', 3),
  ('imc', 'IMC', 'number', '[]', 4),
  ('gordura_corporal_percentual', 'Gordura corporal (%)', 'number', '[]', 5),
  ('cintura_cm', 'Cintura (cm)', 'number', '[]', 6),
  ('abdomen_cm', 'Abdômen (cm)', 'number', '[]', 7),
  ('quadril_cm', 'Quadril (cm)', 'number', '[]', 8),
  ('foto_inicial_frente', 'Foto atual - Frente', 'image', '[]', 9),
  ('foto_inicial_lado', 'Foto atual - Lado', 'image', '[]', 10),
  ('foto_inicial_costas', 'Foto atual - Costas', 'image', '[]', 11)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- procedure_fields: procedure_id obtido por slug (não assume UUID fixo)

-- Drenagem Linfática
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('tipo_drenagem', 'Tipo de drenagem', 'text', '[]', 1),
  ('regiao_tratada', 'Região tratada', 'text', '[]', 2),
  ('edema', 'Edema', 'text', '[]', 3),
  ('duracao_minutos', 'Duração (min)', 'number', '[]', 4)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'drenagem-linfatica' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Botox
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('regioes_aplicadas', 'Regiões aplicadas', 'text', '[]', 1),
  ('unidades_utilizadas', 'Unidades utilizadas', 'number', '[]', 2),
  ('marca_produto', 'Marca do produto', 'text', '[]', 3),
  ('data_reaplicacao_prevista', 'Data reaplicação prevista', 'date', '[]', 4),
  ('fotos_repouso_dinamica', 'Fotos repouso/dinâmica', 'image', '[]', 5)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'botox' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Preenchimento Facial
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('acido_utilizado', 'Ácido utilizado', 'text', '[]', 1),
  ('regiao', 'Região', 'text', '[]', 2),
  ('quantidade_ml', 'Quantidade (ml)', 'number', '[]', 3),
  ('tecnica_aplicada', 'Técnica aplicada', 'text', '[]', 4),
  ('fotos_resultado', 'Fotos resultado', 'image', '[]', 5)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'preenchimento-facial' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Laser / Luz Pulsada
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('tipo_equipamento', 'Tipo de equipamento', 'text', '[]', 1),
  ('parametros_utilizados', 'Parâmetros utilizados', 'text', '[]', 2),
  ('regiao', 'Região', 'text', '[]', 3),
  ('fototipo', 'Fototipo', 'text', '[]', 4),
  ('reacoes_adversas', 'Reações adversas', 'text', '[]', 5)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'laser-luz-pulsada' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Massagem Relaxante
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('duracao_minutos', 'Duração (min)', 'number', '[]', 1),
  ('regioes_trabalhadas', 'Regiões trabalhadas', 'text', '[]', 2),
  ('queixa_cliente', 'Queixa do cliente', 'text', '[]', 3)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'massagem-relaxante' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Criolipólise
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('area_tratada', 'Área tratada', 'text', '[]', 1),
  ('temperatura_aplicacao', 'Temperatura aplicação', 'text', '[]', 2),
  ('tempo_aplicacao_min', 'Tempo aplicação (min)', 'number', '[]', 3),
  ('numero_sessoes', 'Número de sessões', 'number', '[]', 4),
  ('reducao_estimada_percentual', 'Redução estimada (%)', 'number', '[]', 5)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'criolipolise' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- Radiofrequência Corporal
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('regiao', 'Região', 'text', '[]', 1),
  ('potencia', 'Potência', 'text', '[]', 2),
  ('tempo_aplicacao', 'Tempo aplicação', 'text', '[]', 3),
  ('grau_flacidez', 'Grau de flacidez', 'text', '[]', 4)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'radiofrequencia-corporal' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

