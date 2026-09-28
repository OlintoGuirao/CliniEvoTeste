-- Remove a linha "    __PROFISSIONAL__ _________________________" do final dos termos (só Assinatura do Paciente)
UPDATE public.terms
SET body = REPLACE(body, 'Assinatura do Paciente _________________________    __PROFISSIONAL__ _________________________', 'Assinatura do Paciente _________________________')
WHERE body LIKE '%Assinatura do Paciente _________________________    __PROFISSIONAL__ _________________________%';
