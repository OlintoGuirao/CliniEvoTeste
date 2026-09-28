-- Anotações do profissional (blocos de texto livre)

CREATE TABLE IF NOT EXISTS public.professional_anotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professional_anotacoes_title_not_empty CHECK (char_length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_professional_anotacoes_professional_updated
  ON public.professional_anotacoes (professional_id, updated_at DESC);

DROP TRIGGER IF EXISTS update_professional_anotacoes_updated_at ON public.professional_anotacoes;
CREATE TRIGGER update_professional_anotacoes_updated_at
  BEFORE UPDATE ON public.professional_anotacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.professional_anotacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "professional_anotacoes_select_own" ON public.professional_anotacoes;
CREATE POLICY "professional_anotacoes_select_own"
  ON public.professional_anotacoes FOR SELECT
  USING (professional_id = auth.uid());

DROP POLICY IF EXISTS "professional_anotacoes_insert_own" ON public.professional_anotacoes;
CREATE POLICY "professional_anotacoes_insert_own"
  ON public.professional_anotacoes FOR INSERT
  WITH CHECK (professional_id = auth.uid());

DROP POLICY IF EXISTS "professional_anotacoes_update_own" ON public.professional_anotacoes;
CREATE POLICY "professional_anotacoes_update_own"
  ON public.professional_anotacoes FOR UPDATE
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

DROP POLICY IF EXISTS "professional_anotacoes_delete_own" ON public.professional_anotacoes;
CREATE POLICY "professional_anotacoes_delete_own"
  ON public.professional_anotacoes FOR DELETE
  USING (professional_id = auth.uid());
