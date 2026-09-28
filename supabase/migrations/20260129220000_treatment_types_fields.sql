-- Subtítulo opcional e definição dos campos do tratamento (para uso em cadastro / Nova Aplicação)
ALTER TABLE public.treatment_types
ADD COLUMN IF NOT EXISTS subtitle text,
ADD COLUMN IF NOT EXISTS field_definitions jsonb DEFAULT '{"fields":[]}'::jsonb;

COMMENT ON COLUMN public.treatment_types.subtitle IS 'Subtítulo opcional, ex: Botox / Rejuvenescimento';
COMMENT ON COLUMN public.treatment_types.field_definitions IS 'Lista de campos: { "fields": [ { "id": "areas", "label": "Áreas tratadas", "type": "select_multi", "options": [{"id":"testa","label":"Testa"}] }, { "id": "application_date", "label": "Data da aplicação", "type": "date" } ] }';
