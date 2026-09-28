-- Carimbo composto (assinatura + nome + conselho) gerado em Meu perfil

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS professional_stamp_data text;

COMMENT ON COLUMN public.profiles.professional_stamp_data IS
  'Carimbo digital do profissional (data URL PNG): assinatura + nome + conselho.';
