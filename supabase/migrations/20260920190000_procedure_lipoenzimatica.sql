-- Procedimento global: Lipoenzimática (áreas múltiplas + produtos repetíveis)
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT gen_random_uuid(), true, NULL, 'ESTÉTICA CORPORAL', 'Lipoenzimática',
  'Lipoenzimática: áreas tratadas, produtos e técnica por sessão.',
  'lipoenzimatica', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p
  WHERE p.slug = 'lipoenzimatica' AND p.is_global = true
);

INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  -- Âncoras (UI custom; valores em session.data.areas / session.data.produtos)
  ('areas_tratadas', 'Áreas tratadas', 'text', '[]', 1),
  ('produtos_utilizados', 'Produtos utilizados', 'text', '[]', 2),
  -- Flat
  ('contraindicacoes', 'Contraindicações', 'select_multi',
    '["Nenhuma","Gestação","Lactação","Alergia ao produto","Infecção local","Doença autoimune","Uso de anticoagulante","Outros"]', 10),
  ('tecnica_utilizada', 'Técnica utilizada', 'text', '[]', 20),
  ('tipo_agulha_canula', 'Tipo de agulha/cânula', 'text', '[]', 21),
  ('numero_aplicacoes', 'Número de aplicações', 'number', '[]', 22),
  ('regiao_anatomica_detalhada', 'Região anatômica detalhada', 'text', '[]', 23),
  ('profundidade', 'Profundidade', 'text', '[]', 24),
  ('anestesico', 'Anestésico utilizado', 'text', '[]', 25),
  ('antisseptico', 'Antisséptico utilizado', 'text', '[]', 26),
  ('intercorrencias', 'Intercorrências durante o procedimento', 'text', '[]', 30),
  ('conduta', 'Conduta adotada', 'text', '[]', 31),
  ('observacoes_profissional', 'Observações do profissional', 'text', '[]', 32),
  ('orientacoes_pos', 'Orientações pós-procedimento', 'text', '[]', 33)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'lipoenzimatica' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO UPDATE
SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  options = EXCLUDED.options,
  sort_order = EXCLUDED.sort_order;
