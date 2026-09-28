-- Tabela para links curtos dos PDFs de resumo de evolução (URL amigável)
CREATE TABLE IF NOT EXISTS public.evolution_pdf_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evolution_pdf_links_slug ON public.evolution_pdf_links(slug);

COMMENT ON TABLE public.evolution_pdf_links IS 'Links curtos para PDFs de resumo de evolução (ex.: /ver-resumo/abc123)';

ALTER TABLE public.evolution_pdf_links ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode ler por slug (link compartilhado pelo WhatsApp)
CREATE POLICY "Public read evolution pdf links by slug"
  ON public.evolution_pdf_links FOR SELECT
  USING (true);

-- Apenas autenticados podem inserir (profissional gera o link)
CREATE POLICY "Authenticated can insert evolution pdf links"
  ON public.evolution_pdf_links FOR INSERT TO authenticated
  WITH CHECK (true);
