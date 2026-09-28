-- Bucket público para logos do app (sidebar). Leitura pública, upload apenas do dono.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-logos',
  'app-logos',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Usuário autenticado pode fazer upload apenas na pasta do próprio user id
CREATE POLICY "Users can upload own app logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuário pode atualizar/remover apenas os próprios arquivos
CREATE POLICY "Users can update own app logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'app-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own app logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'app-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Leitura pública (bucket público)
CREATE POLICY "Public read app logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'app-logos');
