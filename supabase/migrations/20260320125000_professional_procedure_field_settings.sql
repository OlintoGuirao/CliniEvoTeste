-- =============================================================================
-- Campos dinâmicos por profissional (overlay em cima dos procedure_fields)
-- Objetivo:
-- - Ativar/desativar campos
-- - Definir obrigatoriedade
-- - Definir ordem por profissional
--
-- Não cria colunas dinâmicas: salva preferências em linhas.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.professional_procedure_field_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  procedure_field_id UUID NOT NULL REFERENCES public.procedure_fields(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT professional_procedure_field_unique UNIQUE (professional_id, procedure_field_id),
  -- Um profissional pode ter múltiplos campos configurados por procedimento,
  -- então não limitamos (professional_id, procedure_id) a 1 única linha.
  CHECK (sort_order >= 0)
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS professional_procedure_field_settings_updated_at ON public.professional_procedure_field_settings;
CREATE TRIGGER professional_procedure_field_settings_updated_at
  BEFORE UPDATE ON public.professional_procedure_field_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.professional_procedure_field_settings IS
  'Configurações de campos dinâmicos por profissional (ativa/inativa, obrigatória, ordem) baseadas em procedure_fields';
COMMENT ON COLUMN public.professional_procedure_field_settings.is_active IS 'Se o campo aparece no formulário';
COMMENT ON COLUMN public.professional_procedure_field_settings.is_required IS 'Se o campo é obrigatório para salvar';
COMMENT ON COLUMN public.professional_procedure_field_settings.sort_order IS 'Ordem do campo no formulário (por profissional)';

CREATE INDEX IF NOT EXISTS idx_ppfs_professional_id ON public.professional_procedure_field_settings(professional_id);
CREATE INDEX IF NOT EXISTS idx_ppfs_procedure_id ON public.professional_procedure_field_settings(procedure_id);
CREATE INDEX IF NOT EXISTS idx_ppfs_field_id ON public.professional_procedure_field_settings(procedure_field_id);

ALTER TABLE public.professional_procedure_field_settings ENABLE ROW LEVEL SECURITY;

-- Leitura: o profissional vê apenas a própria configuração (ou o admin vê tudo).
DROP POLICY IF EXISTS "Profissional pode ver suas configs de campos" ON public.professional_procedure_field_settings;
CREATE POLICY "Profissional pode ver suas configs de campos"
  ON public.professional_procedure_field_settings
  FOR SELECT
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

-- Alteração: somente o master/admin pode inserir/atualizar/remover
-- (mantém a regra solicitada no enunciado).
DROP POLICY IF EXISTS "Apenas admin altera configs de campos" ON public.professional_procedure_field_settings;
CREATE POLICY "Apenas admin altera configs de campos"
  ON public.professional_procedure_field_settings
  FOR ALL
  USING ( (auth.jwt() ->> 'email') = 'admin@clinievo.com.br' )
  WITH CHECK ( (auth.jwt() ->> 'email') = 'admin@clinievo.com.br' );

