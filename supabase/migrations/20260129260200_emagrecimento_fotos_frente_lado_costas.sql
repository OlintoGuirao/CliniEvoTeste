-- Emagrecimento: múltiplas fotos Antes/Depois (Frente, Lado, Costas)
-- Substitui o campo único "fotos_antes_depois" por 6 campos específicos.

-- 1) Remover o campo antigo fotos_antes_depois
DELETE FROM public.procedure_fields pf
USING public.procedures p
WHERE pf.procedure_id = p.id
  AND p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
  AND pf.field_key = 'fotos_antes_depois';

-- 2) Inserir 6 campos: Antes (Frente, Lado, Costas) e Depois (Frente, Lado, Costas)
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_antes_frente', 'Antes - Frente', 'image', '[]', 9),
  ('foto_antes_lado', 'Antes - Lado', 'image', '[]', 10),
  ('foto_antes_costas', 'Antes - Costas', 'image', '[]', 11),
  ('foto_depois_frente', 'Depois - Frente', 'image', '[]', 12),
  ('foto_depois_lado', 'Depois - Lado', 'image', '[]', 13),
  ('foto_depois_costas', 'Depois - Costas', 'image', '[]', 14)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;
