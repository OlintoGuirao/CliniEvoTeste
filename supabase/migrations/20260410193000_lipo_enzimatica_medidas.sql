-- Lipo enzimática gordura localizada:
-- adiciona campos de medidas corporais para acompanhamento por sessão.

INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, 'number'::text, '[]'::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (
  VALUES
    ('abdomen_superior_cm', 'Abdômen superior (cm)', 11),
    ('cintura_cm', 'Cintura (cm)', 12),
    ('abdomen_inferior_cm', 'Abdômen inferior (cm)', 13),
    ('braco_cm', 'Braço (cm)', 14),
    ('busto_cm', 'Busto (cm)', 15),
    ('quadril_cm', 'Quadril (cm)', 16)
) AS v(field_key, label, sort_order)
WHERE p.slug = 'lipo-enzimatica-gordura-localizada'
  AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;
