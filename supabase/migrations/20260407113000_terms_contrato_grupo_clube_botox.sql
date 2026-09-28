-- Termo versionado para assinatura obrigatória ao adicionar paciente no Programa de Botox.
INSERT INTO public.terms (slug, version, title, body, active)
VALUES (
  'contrato-grupo-clube-botox',
  1,
  'CONTRATO DE GRUPO CLUBE DO BOTOX',
  E'Contrato de Grupo Clube do Botox.\n\nEste termo é preenchido e renderizado dinamicamente na tela do Programa de Botox com os dados do paciente, profissional, vencimento e quantidade de sessões.',
  true
)
ON CONFLICT (slug, version) DO NOTHING;
