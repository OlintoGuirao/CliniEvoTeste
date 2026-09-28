-- Entradas NF (insumos): controle simples de compras / estoque por profissional
CREATE TABLE IF NOT EXISTS public.insumo_entradas_nf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome_produto TEXT NOT NULL,
  quantidade NUMERIC(14, 3) NOT NULL CHECK (quantidade > 0),
  valor_total NUMERIC(12, 2) NOT NULL CHECK (valor_total >= 0),
  descricao TEXT,
  foto_url TEXT,
  foto_path TEXT,
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.insumo_entradas_nf IS 'Compras de insumos (NF): nome, qtd, valor, descrição, foto opcional; filtro por data_compra.';

CREATE INDEX IF NOT EXISTS idx_insumo_entradas_nf_professional_id ON public.insumo_entradas_nf(professional_id);
CREATE INDEX IF NOT EXISTS idx_insumo_entradas_nf_data_compra ON public.insumo_entradas_nf(data_compra DESC);

DROP TRIGGER IF EXISTS update_insumo_entradas_nf_updated_at ON public.insumo_entradas_nf;
CREATE TRIGGER update_insumo_entradas_nf_updated_at
  BEFORE UPDATE ON public.insumo_entradas_nf
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.insumo_entradas_nf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional vê suas entradas de insumos"
  ON public.insumo_entradas_nf FOR SELECT
  USING (professional_id = auth.uid());

CREATE POLICY "Profissional insere suas entradas de insumos"
  ON public.insumo_entradas_nf FOR INSERT
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Profissional atualiza suas entradas de insumos"
  ON public.insumo_entradas_nf FOR UPDATE
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Profissional exclui suas entradas de insumos"
  ON public.insumo_entradas_nf FOR DELETE
  USING (professional_id = auth.uid());

-- Bucket de fotos (NF / produto)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'insumos-nf',
  'insumos-nf',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated upload insumos-nf" ON storage.objects;
CREATE POLICY "Authenticated upload insumos-nf"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'insumos-nf'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated update insumos-nf" ON storage.objects;
CREATE POLICY "Authenticated update insumos-nf"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'insumos-nf'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated delete insumos-nf" ON storage.objects;
CREATE POLICY "Authenticated delete insumos-nf"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'insumos-nf'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public read insumos-nf" ON storage.objects;
CREATE POLICY "Public read insumos-nf"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'insumos-nf');
