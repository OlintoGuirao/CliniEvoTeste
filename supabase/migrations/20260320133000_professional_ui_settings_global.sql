-- =============================================================================
-- Configurações de UI globais por profissional (não vinculadas a procedimento)
-- Ex.: mostrar/ocultar seção "Fotos da sessão" na tela de consulta.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.professional_ui_settings (
  professional_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  show_session_photos BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS professional_ui_settings_updated_at ON public.professional_ui_settings;
CREATE TRIGGER professional_ui_settings_updated_at
  BEFORE UPDATE ON public.professional_ui_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.professional_ui_settings IS
  'Preferências globais de UI por profissional (não vinculadas a slug/procedimento).';
COMMENT ON COLUMN public.professional_ui_settings.show_session_photos IS
  'Se false, oculta o card "Fotos da sessão" em toda tela de consulta para o profissional';

ALTER TABLE public.professional_ui_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional pode ver sua config global de UI" ON public.professional_ui_settings;
CREATE POLICY "Profissional pode ver sua config global de UI"
  ON public.professional_ui_settings
  FOR SELECT
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

DROP POLICY IF EXISTS "Apenas admin altera config global de UI" ON public.professional_ui_settings;
CREATE POLICY "Apenas admin altera config global de UI"
  ON public.professional_ui_settings
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@clinievo.com.br');

