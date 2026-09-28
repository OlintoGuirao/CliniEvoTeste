-- Modelos de receituário por profissional
CREATE TABLE IF NOT EXISTS public.prescription_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prescription_templates_items_is_array CHECK (jsonb_typeof(items) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_prescription_templates_professional_updated
  ON public.prescription_templates(professional_id, updated_at DESC);

DROP TRIGGER IF EXISTS update_prescription_templates_updated_at ON public.prescription_templates;
CREATE TRIGGER update_prescription_templates_updated_at
  BEFORE UPDATE ON public.prescription_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.prescription_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional vê seus modelos de receituário" ON public.prescription_templates;
CREATE POLICY "Profissional vê seus modelos de receituário"
  ON public.prescription_templates FOR SELECT
  USING (professional_id = auth.uid());

DROP POLICY IF EXISTS "Profissional insere seus modelos de receituário" ON public.prescription_templates;
CREATE POLICY "Profissional insere seus modelos de receituário"
  ON public.prescription_templates FOR INSERT
  WITH CHECK (professional_id = auth.uid());

DROP POLICY IF EXISTS "Profissional atualiza seus modelos de receituário" ON public.prescription_templates;
CREATE POLICY "Profissional atualiza seus modelos de receituário"
  ON public.prescription_templates FOR UPDATE
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

DROP POLICY IF EXISTS "Profissional exclui seus modelos de receituário" ON public.prescription_templates;
CREATE POLICY "Profissional exclui seus modelos de receituário"
  ON public.prescription_templates FOR DELETE
  USING (professional_id = auth.uid());
