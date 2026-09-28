-- Atualiza procedure_fields dos 13 procedimentos com a lista completa de campos.
-- Ordem: Foto Antes da Sessão (1º), demais campos, Foto Depois da Sessão e Observações (últimos).
-- Remove campos antigos e insere os novos para evitar conflitos de chave.

DELETE FROM public.procedure_fields
WHERE procedure_id IN (
  SELECT id FROM public.procedures
  WHERE slug IN (
    'microagulhamento', 'peeling', 'skinbooster', 'ultrassom-microfocado', 'endolaser', 'fios-pdo',
    'preenchimento-facial', 'bioestimulador-colageno', 'lipo-papada-enzimatica', 'lipo-enzimatica-gordura-localizada',
    'acelerador-metabolico', 'harmonizacao-glutea', 'limpeza-de-pele'
  ) AND is_global = true
);

-- 1) Microagulhamento
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('regiao_tratada', 'Região tratada', 'text', '[]', 2),
  ('profundidade_agulha_mm', 'Profundidade da agulha (mm)', 'number', '[]', 3),
  ('numero_passadas', 'Número de passadas', 'number', '[]', 4),
  ('ativos_associados', 'Ativos associados', 'text', '[]', 5),
  ('tipo_dispositivo', 'Tipo de dispositivo', 'select', '["dermapen","roller"]', 6),
  ('sangramento', 'Sangramento', 'select', '["leve","moderado","intenso"]', 7),
  ('produto_calmante_final', 'Produto calmante final', 'text', '[]', 8),
  ('fps_aplicado', 'FPS aplicado', 'text', '[]', 9),
  ('foto_depois_sessao', 'Foto Depois da Sessão', 'image', '[]', 10),
  ('intervalo_entre_sessoes', 'Intervalo entre sessões', 'text', '[]', 11),
  ('observacoes', 'Observações', 'text', '[]', 12)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'microagulhamento' AND p.is_global = true;

-- 2) Peeling
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('regiao_tratada', 'Região tratada', 'text', '[]', 2),
  ('tipo_peeling', 'Tipo de peeling', 'select', '["químico","físico","enzimático"]', 3),
  ('ativo_quimico', 'Ativo químico', 'text', '[]', 4),
  ('concentracao', 'Concentração', 'text', '[]', 5),
  ('numero_camadas', 'Número de camadas', 'number', '[]', 6),
  ('tempo_contato', 'Tempo de contato', 'text', '[]', 7),
  ('neutralizacao_realizada', 'Neutralização realizada', 'select', '["Sim","Não"]', 8),
  ('reacao_imediata_pele', 'Reação imediata da pele', 'text', '[]', 9),
  ('fotoprotecao_indicada', 'Fotoproteção indicada', 'text', '[]', 10),
  ('foto_depois_sessao', 'Foto Depois da Sessão', 'image', '[]', 11),
  ('observacoes', 'Observações', 'text', '[]', 12)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'peeling' AND p.is_global = true;

-- 3) Skinbooster
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('regiao_aplicada', 'Região aplicada', 'text', '[]', 2),
  ('produto', 'Produto', 'text', '[]', 3),
  ('marca', 'Marca', 'text', '[]', 4),
  ('lote', 'Lote', 'text', '[]', 5),
  ('validade', 'Validade', 'text', '[]', 6),
  ('volume_total_ml', 'Volume total (ml)', 'number', '[]', 7),
  ('tecnica_aplicacao', 'Técnica de aplicação', 'text', '[]', 8),
  ('intervalo_entre_sessoes', 'Intervalo entre sessões', 'text', '[]', 9),
  ('foto_depois_sessao', 'Foto Depois da Sessão', 'image', '[]', 10),
  ('observacoes', 'Observações', 'text', '[]', 11)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'skinbooster' AND p.is_global = true;

-- 4) Ultrassom Microfocado
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('regiao_tratada', 'Região tratada', 'text', '[]', 2),
  ('equipamento', 'Equipamento', 'text', '[]', 3),
  ('modelo', 'Modelo', 'text', '[]', 4),
  ('profundidade_mm', 'Profundidade (mm)', 'number', '[]', 5),
  ('numero_disparos', 'Número de disparos', 'number', '[]', 6),
  ('energia_utilizada', 'Energia utilizada', 'text', '[]', 7),
  ('tempo_sessao', 'Tempo de sessão', 'text', '[]', 8),
  ('protocolo_utilizado', 'Protocolo utilizado', 'text', '[]', 9),
  ('dor_relatada', 'Dor relatada', 'select', '["leve","moderada","intensa"]', 10),
  ('foto_depois_sessao', 'Foto Depois da Sessão', 'image', '[]', 11),
  ('observacoes', 'Observações', 'text', '[]', 12)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'ultrassom-microfocado' AND p.is_global = true;

-- 5) Endolaser
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('regiao_tratada', 'Região tratada', 'text', '[]', 2),
  ('equipamento', 'Equipamento', 'text', '[]', 3),
  ('tipo_fibra', 'Tipo de fibra', 'text', '[]', 4),
  ('comprimento_onda', 'Comprimento de onda', 'text', '[]', 5),
  ('potencia', 'Potência', 'text', '[]', 6),
  ('energia_total_aplicada', 'Energia total aplicada', 'text', '[]', 7),
  ('tempo_aplicacao', 'Tempo de aplicação', 'text', '[]', 8),
  ('tecnica_utilizada', 'Técnica utilizada', 'text', '[]', 9),
  ('anestesia', 'Anestesia', 'select', '["Sim","Não"]', 10),
  ('intercorrencias', 'Intercorrências', 'text', '[]', 11),
  ('foto_depois_sessao', 'Foto Depois da Sessão', 'image', '[]', 12),
  ('observacoes_clinicas', 'Observações clínicas', 'text', '[]', 13)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'endolaser' AND p.is_global = true;

-- 6) Fios de PDO
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('regiao_tratada', 'Região tratada', 'text', '[]', 2),
  ('tipo_fio', 'Tipo de fio', 'text', '[]', 3),
  ('quantidade_fios', 'Quantidade de fios', 'number', '[]', 4),
  ('marca', 'Marca', 'text', '[]', 5),
  ('lote', 'Lote', 'text', '[]', 6),
  ('tecnica_insercao', 'Técnica de inserção', 'text', '[]', 7),
  ('vetores', 'Vetores', 'text', '[]', 8),
  ('simetria_avaliada', 'Simetria avaliada', 'text', '[]', 9),
  ('anestesia_utilizada', 'Anestesia utilizada', 'text', '[]', 10),
  ('intercorrencias', 'Intercorrências', 'text', '[]', 11),
  ('foto_depois_sessao', 'Foto Depois da Sessão', 'image', '[]', 12),
  ('observacoes', 'Observações', 'text', '[]', 13)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'fios-pdo' AND p.is_global = true;

-- 7) Preenchimento Facial
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('regiao_aplicada', 'Região aplicada', 'text', '[]', 2),
  ('produto', 'Produto', 'text', '[]', 3),
  ('marca', 'Marca', 'text', '[]', 4),
  ('lote', 'Lote', 'text', '[]', 5),
  ('validade', 'Validade', 'text', '[]', 6),
  ('volume_total_ml', 'Volume total (ml)', 'number', '[]', 7),
  ('tecnica', 'Técnica', 'text', '[]', 8),
  ('plano_aplicacao', 'Plano de aplicação', 'text', '[]', 9),
  ('simetria_avaliada', 'Simetria avaliada', 'text', '[]', 10),
  ('intercorrencias', 'Intercorrências', 'text', '[]', 11),
  ('data_reavaliacao', 'Data de reavaliação', 'date', '[]', 12),
  ('foto_depois_sessao', 'Foto Depois da Sessão', 'image', '[]', 13),
  ('observacoes', 'Observações', 'text', '[]', 14)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'preenchimento-facial' AND p.is_global = true;

-- 8) Bioestimulador de Colágeno
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('regiao_tratada', 'Região tratada', 'text', '[]', 2),
  ('produto', 'Produto', 'text', '[]', 3),
  ('marca', 'Marca', 'text', '[]', 4),
  ('lote', 'Lote', 'text', '[]', 5),
  ('validade', 'Validade', 'text', '[]', 6),
  ('volume_aplicado', 'Volume aplicado', 'text', '[]', 7),
  ('tecnica', 'Técnica', 'text', '[]', 8),
  ('intervalo_entre_sessoes', 'Intervalo entre sessões', 'text', '[]', 9),
  ('intercorrencias', 'Intercorrências', 'text', '[]', 10),
  ('data_retorno', 'Data de retorno', 'date', '[]', 11),
  ('foto_depois_sessao', 'Foto Depois da Sessão', 'image', '[]', 12),
  ('observacoes', 'Observações', 'text', '[]', 13)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'bioestimulador-colageno' AND p.is_global = true;

-- 9) Lipo de Papada Enzimática
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('produto', 'Produto', 'text', '[]', 2),
  ('ativo_principal', 'Ativo principal', 'text', '[]', 3),
  ('marca', 'Marca', 'text', '[]', 4),
  ('lote', 'Lote', 'text', '[]', 5),
  ('volume_aplicado', 'Volume aplicado', 'number', '[]', 6),
  ('tecnica', 'Técnica', 'text', '[]', 7),
  ('edema_observado', 'Edema observado', 'text', '[]', 8),
  ('foto_depois_sessao', 'Foto Depois da Sessão', 'image', '[]', 9),
  ('observacoes', 'Observações', 'text', '[]', 10)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'lipo-papada-enzimatica' AND p.is_global = true;

-- 10) Lipo Enzimática – Gordura Localizada
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('regiao_tratada', 'Região tratada (abdômen, flanco, braço, culote)', 'text', '[]', 2),
  ('produto', 'Produto', 'text', '[]', 3),
  ('ativo_principal', 'Ativo principal', 'text', '[]', 4),
  ('marca', 'Marca', 'text', '[]', 5),
  ('lote', 'Lote', 'text', '[]', 6),
  ('volume_aplicado', 'Volume aplicado', 'number', '[]', 7),
  ('tecnica', 'Técnica', 'text', '[]', 8),
  ('foto_sessao', 'Foto Depois da Sessão', 'image', '[]', 9),
  ('observacoes', 'Observações', 'text', '[]', 10)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'lipo-enzimatica-gordura-localizada' AND p.is_global = true;

-- 11) Acelerador Metabólico
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('protocolo', 'Protocolo', 'text', '[]', 2),
  ('ativos_utilizados', 'Ativos utilizados', 'text', '[]', 3),
  ('doses', 'Doses', 'text', '[]', 4),
  ('foto_sessao_atual', 'Foto Sessão atual', 'image', '[]', 5),
  ('peso_atual', 'Peso atual', 'number', '[]', 6),
  ('observacoes', 'Observações', 'text', '[]', 7)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'acelerador-metabolico' AND p.is_global = true;

-- 12) Harmonização Glútea
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('regiao_tratada', 'Região tratada', 'text', '[]', 2),
  ('produto', 'Produto', 'text', '[]', 3),
  ('marca', 'Marca', 'text', '[]', 4),
  ('lote', 'Lote', 'text', '[]', 5),
  ('volume_total_aplicado', 'Volume total aplicado', 'number', '[]', 6),
  ('tecnica', 'Técnica', 'text', '[]', 7),
  ('pontos_aplicacao_campo', 'Pontos de aplicação', 'text', '[]', 8),
  ('simetria_avaliada', 'Simetria avaliada', 'text', '[]', 9),
  ('intercorrencias', 'Intercorrências', 'text', '[]', 10),
  ('foto_depois_sessao', 'Foto Depois da Sessão', 'image', '[]', 11),
  ('observacoes', 'Observações', 'text', '[]', 12)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'harmonizacao-glutea' AND p.is_global = true;

-- 13) Limpeza de Pele
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_sessao', 'Foto Antes da Sessão', 'image', '[]', 1),
  ('tipo_pele', 'Tipo de pele', 'text', '[]', 2),
  ('regiao_tratada', 'Região tratada', 'text', '[]', 3),
  ('higienizacao_realizada', 'Higienização realizada', 'text', '[]', 4),
  ('emoliencia', 'Emoliência', 'select', '["Sim","Não"]', 5),
  ('extracao', 'Extração', 'select', '["Sim","Não"]', 6),
  ('tipo_extracao', 'Tipo de extração', 'text', '[]', 7),
  ('produtos_utilizados', 'Produtos utilizados', 'text', '[]', 8),
  ('mascara_final', 'Máscara final', 'text', '[]', 9),
  ('fps_aplicado', 'FPS aplicado', 'text', '[]', 10),
  ('foto_depois_sessao', 'Foto Depois da Sessão', 'image', '[]', 11),
  ('observacoes', 'Observações', 'text', '[]', 12)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'limpeza-de-pele' AND p.is_global = true;
