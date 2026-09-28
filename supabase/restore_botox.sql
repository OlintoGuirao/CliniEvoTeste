-- =============================================================================
-- Restaurar procedimento Botox (Toxina Botulínica) no banco
-- Use quando o registro tiver sido apagado por engano.
-- Executar no Supabase: SQL Editor → colar e rodar.
-- =============================================================================

-- 1) Inserir o procedimento (só se ainda não existir um global com slug 'botox')
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT
  'a2000000-0000-4000-8000-000000000001'::uuid,
  true,
  NULL::uuid,
  'ESTÉTICA FACIAL',
  'Botox (Toxina Botulínica)',
  'Aplicação de toxina botulínica',
  'botox',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p
  WHERE p.slug = 'botox' AND p.is_global = true AND (p.created_by IS NULL OR p.created_by = '00000000-0000-0000-0000-000000000000'::uuid)
);

-- 2) Inserir os campos dinâmicos do Botox (o app usa formulário próprio; estes são fallback/legado)
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
