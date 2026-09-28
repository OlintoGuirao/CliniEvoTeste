-- Emagrecimento: dados iniciais = apenas "Foto atual" (Frente, Lado, Costas).
-- Antes/depois é mostrado na ficha: Antes = 1ª sessão; Depois = fotos adicionadas nas sessões.

-- 1) Remover os 6 campos Antes/Depois
DELETE FROM public.procedure_fields pf
USING public.procedures p
WHERE pf.procedure_id = p.id
  AND p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
  AND pf.field_key IN ('foto_antes_frente', 'foto_antes_lado', 'foto_antes_costas', 'foto_depois_frente', 'foto_depois_lado', 'foto_depois_costas');

-- 2) Inserir 3 campos: Foto atual - Frente, Lado, Costas (dados iniciais)
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  ('foto_inicial_frente', 'Foto atual - Frente', 'image', '[]', 9),
  ('foto_inicial_lado', 'Foto atual - Lado', 'image', '[]', 10),
  ('foto_inicial_costas', 'Foto atual - Costas', 'image', '[]', 11)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'emagrecimento-reducao-medidas' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO NOTHING;

-- 3) Bucket para fotos de procedimentos (upload + leitura pública)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'procedure-photos',
  'procedure-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Upload: path {user_id}/{instance_id ou 'temp'}/{filename}
CREATE POLICY "Users can upload procedure photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'procedure-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own procedure photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'procedure-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own procedure photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'procedure-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public read procedure photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'procedure-photos');
