-- Bucket público para PDFs de resumo de evolução (link para envio por WhatsApp)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evolution-pdfs',
  'evolution-pdfs',
  true,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Autenticados podem inserir em pastas com seu user id
DROP POLICY IF EXISTS "Authenticated can upload evolution pdfs" ON storage.objects;
CREATE POLICY "Authenticated can upload evolution pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evolution-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leitura pública para links do WhatsApp
DROP POLICY IF EXISTS "Public read evolution pdfs" ON storage.objects;
CREATE POLICY "Public read evolution pdfs"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'evolution-pdfs');
