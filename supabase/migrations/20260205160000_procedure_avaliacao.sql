-- Procedimento "Avaliação": quando selecionado, o paciente aparece em "Futuros clientes" (não na lista de clientes) até concluir o cadastro.
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT v.id, v.is_global, v.created_by, v.category, v.name, v.description, v.slug, v.is_active
FROM (VALUES
  ('b1000000-0000-4000-8000-000000000099'::uuid, true, NULL::uuid, 'OUTROS', 'Avaliação', 'Avaliação inicial; paciente aparece em Futuros clientes até concluir cadastro.', 'avaliacao', true)
) AS v(id, is_global, created_by, category, name, description, slug, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p WHERE p.slug = 'avaliacao'
);
