-- Remove o bloco "Procedimento (marque):" e as 4 opções do termo de preenchedores
UPDATE public.terms
SET body = REPLACE(
  body,
  E'\n\nProcedimento (marque):\n( ) Preenchimento facial para rugas finas e lábios\n( ) Preenchimento facial para rugas médias e profundas\n( ) Preenchimento facial para rugas profundas e muito profundas\n( ) Preenchimento facial para rugas muito profundas e contorno facial\n\n',
  E'\n\n'
)
WHERE slug = 'consentimento-preenchedores'
  AND body LIKE '%Procedimento (marque):%';
