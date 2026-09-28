-- Procedimentos ausentes (idempotente). Não altera procedimentos existentes.
-- Inclui: depilação definitiva FEM/MASC, ultrassom macrofocado, ozônio, I-Lipo, enzimas, fios aptos.
-- Estende lembretes (reuso botox) com área tratada opcional.

ALTER TABLE public.botox_reapplication_reminders
  ADD COLUMN IF NOT EXISTS area_key text,
  ADD COLUMN IF NOT EXISTS area_label text,
  ADD COLUMN IF NOT EXISTS reminder_kind text;

COMMENT ON COLUMN public.botox_reapplication_reminders.area_key IS
  'Área tratada (ex.: depilação definitiva); NULL para lembretes de Botox.';
COMMENT ON COLUMN public.botox_reapplication_reminders.area_label IS
  'Rótulo legível da área para mensagem de lembrete.';
COMMENT ON COLUMN public.botox_reapplication_reminders.reminder_kind IS
  'botox | depilacao_definitiva | outro; NULL tratado como botox.';

CREATE INDEX IF NOT EXISTS idx_botox_reminders_session_area
  ON public.botox_reapplication_reminders (procedure_session_id, area_key)
  WHERE procedure_session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Helpers locais via DO blocks por procedimento
-- ---------------------------------------------------------------------------

-- 1) Depilação definitiva feminina
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT gen_random_uuid(), true, NULL, 'TECNOLOGIAS ESTÉTICAS',
  'Depilação definitiva feminina',
  'Depilação definitiva feminina por área, com histórico e lembretes.',
  'depilacao-definitiva-feminina', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p WHERE p.slug = 'depilacao-definitiva-feminina' AND p.is_global = true
);

INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('areas_tratadas', 'Áreas tratadas', 'text', '[]', 1),
  ('tipo_depilacao', 'Tipo de depilação', 'text', '[]', 10),
  ('equipamento_utilizado', 'Equipamento utilizado', 'text', '[]', 11),
  ('tecnologia_utilizada', 'Tecnologia utilizada', 'text', '[]', 12),
  ('marca_modelo_equipamento', 'Marca e modelo do equipamento', 'text', '[]', 13),
  ('frequencia_equipamento', 'Frequência do equipamento', 'text', '[]', 14),
  ('unidade_frequencia', 'Unidade da frequência', 'text', '[]', 15),
  ('intervalo_entre_sessoes', 'Intervalo recomendado entre sessões', 'text', '[]', 16),
  ('fototipo', 'Fototipo de pele', 'select', '["I","II","III","IV","V","VI"]', 17),
  ('cor_pelos', 'Cor dos pelos', 'text', '[]', 18),
  ('espessura_pelos', 'Espessura dos pelos', 'select', '["finos","médios","grossos"]', 19),
  ('sensibilidade_pele', 'Sensibilidade da pele', 'select', '["baixa","média","alta"]', 20),
  ('gel_produto', 'Gel ou produto utilizado', 'text', '[]', 21),
  ('orientacoes_proxima', 'Orientações antes da próxima sessão', 'text', '[]', 30),
  ('intercorrencias', 'Intercorrências', 'text', '[]', 31),
  ('conduta', 'Conduta adotada', 'text', '[]', 32),
  ('orientacoes_pos', 'Orientações pós-procedimento', 'text', '[]', 33),
  ('observacoes', 'Observações', 'text', '[]', 34)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'depilacao-definitiva-feminina' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO UPDATE
SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, options = EXCLUDED.options, sort_order = EXCLUDED.sort_order;

-- 2) Depilação definitiva masculina
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT gen_random_uuid(), true, NULL, 'TECNOLOGIAS ESTÉTICAS',
  'Depilação definitiva masculina',
  'Depilação definitiva masculina por área, com histórico e lembretes.',
  'depilacao-definitiva-masculina', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p WHERE p.slug = 'depilacao-definitiva-masculina' AND p.is_global = true
);

INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('areas_tratadas', 'Áreas tratadas', 'text', '[]', 1),
  ('tipo_depilacao', 'Tipo de depilação', 'text', '[]', 10),
  ('equipamento_utilizado', 'Equipamento utilizado', 'text', '[]', 11),
  ('tecnologia_utilizada', 'Tecnologia utilizada', 'text', '[]', 12),
  ('marca_modelo_equipamento', 'Marca e modelo do equipamento', 'text', '[]', 13),
  ('frequencia_equipamento', 'Frequência do equipamento', 'text', '[]', 14),
  ('unidade_frequencia', 'Unidade da frequência', 'text', '[]', 15),
  ('intervalo_entre_sessoes', 'Intervalo recomendado entre sessões', 'text', '[]', 16),
  ('fototipo', 'Fototipo de pele', 'select', '["I","II","III","IV","V","VI"]', 17),
  ('cor_pelos', 'Cor dos pelos', 'text', '[]', 18),
  ('espessura_pelos', 'Espessura dos pelos', 'select', '["finos","médios","grossos"]', 19),
  ('sensibilidade_pele', 'Sensibilidade da pele', 'select', '["baixa","média","alta"]', 20),
  ('gel_produto', 'Gel ou produto utilizado', 'text', '[]', 21),
  ('orientacoes_proxima', 'Orientações antes da próxima sessão', 'text', '[]', 30),
  ('intercorrencias', 'Intercorrências', 'text', '[]', 31),
  ('conduta', 'Conduta adotada', 'text', '[]', 32),
  ('orientacoes_pos', 'Orientações pós-procedimento', 'text', '[]', 33),
  ('observacoes', 'Observações', 'text', '[]', 34)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'depilacao-definitiva-masculina' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO UPDATE
SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, options = EXCLUDED.options, sort_order = EXCLUDED.sort_order;

-- 3) Ultrassom macrofocado
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT gen_random_uuid(), true, NULL, 'TECNOLOGIAS ESTÉTICAS',
  'Ultrassom macrofocado',
  'Ultrassom macrofocado corporal com áreas tratadas.',
  'ultrassom-macrofocado', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p WHERE p.slug = 'ultrassom-macrofocado' AND p.is_global = true
);

INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('areas_tratadas', 'Áreas tratadas', 'text', '[]', 1),
  ('equipamento', 'Equipamento', 'text', '[]', 10),
  ('marca_modelo', 'Marca e modelo', 'text', '[]', 11),
  ('gel_utilizado', 'Gel utilizado', 'text', '[]', 12),
  ('reacao_imediata', 'Reação imediata', 'text', '[]', 20),
  ('intercorrencias', 'Intercorrências', 'text', '[]', 21),
  ('orientacoes_pos', 'Orientações pós-procedimento', 'text', '[]', 22),
  ('data_retorno', 'Data de retorno', 'date', '[]', 23),
  ('observacoes', 'Observações', 'text', '[]', 24)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'ultrassom-macrofocado' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO UPDATE
SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, options = EXCLUDED.options, sort_order = EXCLUDED.sort_order;

-- 4) Ozônio
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT gen_random_uuid(), true, NULL, 'TECNOLOGIAS ESTÉTICAS',
  'Ozônio',
  'Aplicação de ozônio terapêutico/estético.',
  'ozonio', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p WHERE p.slug = 'ozonio' AND p.is_global = true
);

INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('forma_aplicacao', 'Forma de aplicação', 'text', '[]', 1),
  ('regiao_tratada', 'Região tratada', 'text', '[]', 2),
  ('equipamento', 'Equipamento', 'text', '[]', 3),
  ('concentracao', 'Concentração', 'text', '[]', 4),
  ('volume', 'Volume', 'text', '[]', 5),
  ('tempo_aplicacao', 'Tempo de aplicação', 'text', '[]', 6),
  ('via_tecnica', 'Via ou técnica utilizada', 'text', '[]', 7),
  ('produto_gas', 'Produto ou gás utilizado', 'text', '[]', 8),
  ('numero_sessao', 'Número da sessão', 'number', '[]', 9),
  ('reacao_imediata', 'Reação imediata', 'text', '[]', 10),
  ('intercorrencias', 'Intercorrências', 'text', '[]', 11),
  ('orientacoes_pos', 'Orientações pós-procedimento', 'text', '[]', 12),
  ('data_retorno', 'Data de retorno', 'date', '[]', 13),
  ('observacoes', 'Observações', 'text', '[]', 14)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'ozonio' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO UPDATE
SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, options = EXCLUDED.options, sort_order = EXCLUDED.sort_order;

-- 5) I-Lipo
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT gen_random_uuid(), true, NULL, 'ESTÉTICA CORPORAL',
  'I-Lipo',
  'I-Lipo com áreas tratadas e medidas.',
  'i-lipo', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p WHERE p.slug = 'i-lipo' AND p.is_global = true
);

INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('areas_tratadas', 'Áreas tratadas', 'text', '[]', 1),
  ('equipamento', 'Equipamento', 'text', '[]', 10),
  ('marca_modelo', 'Marca e modelo', 'text', '[]', 11),
  ('programa_utilizado', 'Programa utilizado', 'text', '[]', 12),
  ('numero_sessao', 'Número da sessão', 'number', '[]', 13),
  ('reacao_imediata', 'Reação imediata', 'text', '[]', 20),
  ('orientacoes_pos', 'Orientações', 'text', '[]', 21),
  ('data_retorno', 'Data de retorno', 'date', '[]', 22),
  ('observacoes', 'Observações', 'text', '[]', 23)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'i-lipo' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO UPDATE
SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, options = EXCLUDED.options, sort_order = EXCLUDED.sort_order;

-- 6) Enzimas
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT gen_random_uuid(), true, NULL, 'ESTÉTICA CORPORAL',
  'Enzimas',
  'Aplicação de enzimas por região.',
  'enzimas', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p WHERE p.slug = 'enzimas' AND p.is_global = true
);

INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('areas_tratadas', 'Áreas tratadas', 'text', '[]', 1),
  ('produto', 'Produto', 'text', '[]', 10),
  ('principio_ativo', 'Princípio ativo', 'text', '[]', 11),
  ('fabricante', 'Fabricante', 'text', '[]', 12),
  ('lote', 'Lote', 'text', '[]', 13),
  ('validade', 'Validade', 'date', '[]', 14),
  ('diluicao', 'Diluição', 'text', '[]', 15),
  ('numero_sessao', 'Número da sessão', 'number', '[]', 16),
  ('reacao_imediata', 'Reação imediata', 'text', '[]', 20),
  ('intercorrencias', 'Intercorrências', 'text', '[]', 21),
  ('orientacoes_pos', 'Orientações pós-procedimento', 'text', '[]', 22),
  ('data_retorno', 'Data de retorno', 'date', '[]', 23),
  ('observacoes', 'Observações', 'text', '[]', 24)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'enzimas' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO UPDATE
SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, options = EXCLUDED.options, sort_order = EXCLUDED.sort_order;

-- 7) Fios aptos (novo; não altera fios-pdo)
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT gen_random_uuid(), true, NULL, 'ESTÉTICA FACIAL',
  'Fios aptos',
  'Aplicação de fios aptos.',
  'fios-aptos', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p WHERE p.slug = 'fios-aptos' AND p.is_global = true
);

INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('regiao_tratada', 'Região tratada', 'text', '[]', 1),
  ('tipo_fio', 'Tipo de fio', 'text', '[]', 2),
  ('material', 'Material', 'text', '[]', 3),
  ('marca', 'Marca', 'text', '[]', 4),
  ('lote', 'Lote', 'text', '[]', 5),
  ('validade', 'Validade', 'date', '[]', 6),
  ('quantidade_fios', 'Quantidade de fios', 'number', '[]', 7),
  ('comprimento', 'Comprimento', 'text', '[]', 8),
  ('espessura', 'Espessura', 'text', '[]', 9),
  ('tecnica_utilizada', 'Técnica utilizada', 'text', '[]', 10),
  ('tipo_anestesico', 'Tipo de anestésico', 'text', '[]', 11),
  ('pontos_entrada', 'Pontos de entrada', 'text', '[]', 12),
  ('intercorrencias', 'Intercorrências', 'text', '[]', 13),
  ('orientacoes_pos', 'Orientações pós-procedimento', 'text', '[]', 14),
  ('data_retorno', 'Data de retorno', 'date', '[]', 15),
  ('observacoes', 'Observações', 'text', '[]', 16)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'fios-aptos' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO UPDATE
SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, options = EXCLUDED.options, sort_order = EXCLUDED.sort_order;
