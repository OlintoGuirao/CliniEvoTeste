-- =============================================================================
-- Configurações de UI por profissional + procedimento
-- Ex.: mostrar/ocultar seção "Fotos da sessão"
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.professional_procedure_ui_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  show_session_photos BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT professional_procedure_ui_unique UNIQUE (professional_id, procedure_id)
);

DROP TRIGGER IF EXISTS professional_procedure_ui_settings_updated_at ON public.professional_procedure_ui_settings;
CREATE TRIGGER professional_procedure_ui_settings_updated_at
  BEFORE UPDATE ON public.professional_procedure_ui_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.professional_procedure_ui_settings IS
  'Preferências visuais por profissional/procedimento (ex.: mostrar seção de fotos da sessão)';
COMMENT ON COLUMN public.professional_procedure_ui_settings.show_session_photos IS
  'Se true, mostra a seção "Fotos da sessão" na tela da consulta';

CREATE INDEX IF NOT EXISTS idx_ppus_professional_id
  ON public.professional_procedure_ui_settings(professional_id);
CREATE INDEX IF NOT EXISTS idx_ppus_procedure_id
  ON public.professional_procedure_ui_settings(procedure_id);

ALTER TABLE public.professional_procedure_ui_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional pode ver suas configs de UI" ON public.professional_procedure_ui_settings;
CREATE POLICY "Profissional pode ver suas configs de UI"
  ON public.professional_procedure_ui_settings
  FOR SELECT
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

DROP POLICY IF EXISTS "Apenas admin altera configs de UI" ON public.professional_procedure_ui_settings;
CREATE POLICY "Apenas admin altera configs de UI"
  ON public.professional_procedure_ui_settings
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');

