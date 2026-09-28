-- Garante procedimento Depilação a Laser + campos + permissão para perfis com allowlist

-- 1) Procedimento global (caso não exista no banco)
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
VALUES (
  'a4000000-0000-4000-8000-000000000002'::uuid,
  true,
  NULL,
  'TECNOLOGIAS ESTÉTICAS',
  'Depilação a Laser',
  'Depilação: região, fototipo, potência, sessões',
  'depilacao-laser',
  true
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  is_active = true,
  is_global = true;

-- Fallback se o UUID seed não existir mas o slug já estiver com outro id
UPDATE public.procedures
SET is_active = true, is_global = true
WHERE slug = 'depilacao-laser';

-- 2) Campos do procedimento
WITH fields AS (
  SELECT * FROM (VALUES
    ('regiao_tratada', 'Região tratada', 'select_multi', '["Buço","Axilas","Virilha","Perna inteira","Meia perna","Braço","Costas","Abdômen","Rosto","Outro"]'::jsonb, 1),
    ('fototipo', 'Fototipo', 'select', '["I","II","III","IV","V","VI"]'::jsonb, 2),
    ('tipo_equipamento', 'Equipamento utilizado', 'text', '[]'::jsonb, 3),
    ('fluencia', 'Fluência / potência', 'text', '[]'::jsonb, 4),
    ('pulse_duration', 'Duração do pulso', 'text', '[]'::jsonb, 5),
    ('spot_size', 'Spot size', 'text', '[]'::jsonb, 6),
    ('numero_sessao', 'Número da sessão', 'number', '[]'::jsonb, 7),
    ('total_sessoes_previstas', 'Total de sessões previstas', 'number', '[]'::jsonb, 8),
    ('reacao_pele', 'Reação da pele', 'select', '["Sem reação","Eritema leve","Eritema moderado","Outro"]'::jsonb, 9),
    ('observacoes', 'Observações', 'text', '[]'::jsonb, 10),
    ('foto_antes', 'Foto antes', 'image', '[]'::jsonb, 11),
    ('foto_depois', 'Foto depois', 'image', '[]'::jsonb, 12)
  ) AS t(field_key, label, field_type, options, sort_order)
)
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, f.field_key, f.label, f.field_type, f.options, f.sort_order
FROM public.procedures p
CROSS JOIN fields f
WHERE p.slug = 'depilacao-laser' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- 3) Libera o procedimento para todos os perfis que JÁ usam allowlist de permissões.
-- (Perfis sem nenhuma linha em profile_procedure_permissions já veem todos os procedimentos.)
INSERT INTO public.profile_procedure_permissions (profile_id, procedure_id, visible)
SELECT DISTINCT perm.profile_id, p.id, true
FROM public.profile_procedure_permissions perm
CROSS JOIN public.procedures p
WHERE p.slug = 'depilacao-laser'
  AND p.is_global = true
  AND p.is_active = true
ON CONFLICT (profile_id, procedure_id) DO UPDATE
SET visible = true;
