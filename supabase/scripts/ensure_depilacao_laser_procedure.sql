-- Script manual: cria/ativa "Depilação a Laser" e faz SELECT de verificação.
-- Cole no SQL Editor do Supabase (rola com service role / postgres).

DO $$
DECLARE
  v_procedure_id uuid;
BEGIN
  SELECT id INTO v_procedure_id
  FROM public.procedures
  WHERE slug = 'depilacao-laser'
  ORDER BY is_global DESC, created_at ASC
  LIMIT 1;

  IF v_procedure_id IS NULL THEN
    v_procedure_id := 'a4000000-0000-4000-8000-000000000002'::uuid;
    INSERT INTO public.procedures (
      id, is_global, created_by, category, name, description, slug, is_active
    ) VALUES (
      v_procedure_id,
      true,
      NULL,
      'TECNOLOGIAS ESTÉTICAS',
      'Depilação a Laser',
      'Depilação: região, fototipo, potência, sessões',
      'depilacao-laser',
      true
    );
  ELSE
    UPDATE public.procedures
    SET
      is_active = true,
      is_global = true,
      created_by = NULL,
      category = 'TECNOLOGIAS ESTÉTICAS',
      name = 'Depilação a Laser',
      description = COALESCE(NULLIF(description, ''), 'Depilação: região, fototipo, potência, sessões'),
      slug = 'depilacao-laser'
    WHERE id = v_procedure_id;
  END IF;

  INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
  SELECT v_procedure_id, f.field_key, f.label, f.field_type, f.options, f.sort_order
  FROM (VALUES
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
  ) AS f(field_key, label, field_type, options, sort_order)
  ON CONFLICT (procedure_id, field_key) DO NOTHING;

  -- Libera para perfis que já usam allowlist
  INSERT INTO public.profile_procedure_permissions (profile_id, procedure_id, visible)
  SELECT DISTINCT perm.profile_id, v_procedure_id, true
  FROM public.profile_procedure_permissions perm
  ON CONFLICT (profile_id, procedure_id) DO UPDATE
  SET visible = true;
END $$;

-- Conferência: deve retornar 1 linha
SELECT id, name, slug, category, is_active, is_global
FROM public.procedures
WHERE slug = 'depilacao-laser';
