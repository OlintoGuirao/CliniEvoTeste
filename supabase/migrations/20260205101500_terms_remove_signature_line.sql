-- Remove a linha completa "Assinatura do Paciente ..." (e eventual linha do profissional) do final do corpo dos termos
UPDATE public.terms
SET body = REPLACE(
  REPLACE(
    body,
    E'\n\nAssinatura do Paciente _________________________    __PROFISSIONAL__ _________________________',
    ''
  ),
  E'\n\nAssinatura do Paciente _________________________',
  ''
)
WHERE body LIKE '%Assinatura do Paciente _________________________%';
