-- =============================================================================
-- Termo de consentimento - Endolift/Endolaser (Endolaser Facial/Corporal + Fibra Óptica)
-- =============================================================================

INSERT INTO public.terms (slug, version, title, body, active)
VALUES (
  'consentimento-endolaser',
  1,
  'TERMO DE CONSENTIMENTO INFORMADO DE ENDOLIFTING (ENDOLASER)',
  E'Por meio deste termo eu, __NOME_PACIENTE__,
com o CPF: __CPF__,
idade: __IDADE__, telefone __TELEFONE__,
declaro estar de acordo com o plano de tratamento proposto - ENDOLIFTING: ENDOLASER FACIAL / CORPORAL COM FIBRA ÓPTICA.

Fui devidamente esclarecido(a) de que o objetivo deste procedimento são:
• Lipólise – Redução de gordura;
• Endurecimento/ enrijecimento da pele;
• Contração (retração) da pele;
• Estímulo de colágeno com melhora da textura da pele;
• Efeito lifting;

Os efeitos variam de pessoa para pessoa, portanto ninguém serve de parâmetro para outrem. Pode ser necessário mais de uma sessão para se obter o resultado desejado pelo cliente, devendo ser espaçado a cada 30 dias.

Alguns pacientes apresentam resultados imediatos, e outros com até 6 meses. É válido esclarecer que todos os clientes terão algum resultado, mas o resultado imediato está relacionado:
- Área realizada;
- Duração do procedimento (edema);
- Quantidade de anestesia e solução anestésica utilizada;
- Potência utilizada;
- Metabolismo do cliente;
- Hábitos do cliente.

Fui orientado(a) a respeito do procedimento a ser realizado, como é o pós-operatório e efeitos colaterais esperados, descritos a seguir.

• Hematoma (aparecimento de manchas roxas, amareladas, esverdeadas);
• Edema (inchaço avermelhado),
• Sensação de queimação,
• Dor,
• Inchaço,
• Dormência,
• Formigamento.

Este procedimento é classificado entre os Procedimentos Minimamente Invasivos, em que os efeitos colaterais indesejados ocorrem de forma muito reduzida em relação a outros métodos. Se ocorrerem, desaparecem espontaneamente nas primeiras 48 a 72 horas, podendo esse tempo ser indeterminado, a depender da resposta biológica do paciente. Me foi explicado que existe possibilidade de complicações, tais quais:

· Intoxicação pelo sal anestésico (reação alérgica);
· Lesão de nervo na face, resultando em assimetria do sorriso temporária. Tais complicações descritas acima poderão acarretar gastos extras com profissionais de outras áreas no tratamento para resolução delas;
· Pequena queimadura devido ao aquecimento interno. Dependendo da área e conduta profissional, pode gerar pequenas bolhas e posterior ferida, que deve ser tratada com medicações apropriadas.

Estou ciente também que as mudanças em minha face/aparência, causadas por essa terapia, não são permanentes, podendo haver novo acúmulo de gordura se houver aumento de peso, sedentarismo ou de dieta alimentar inadequada. Essa gordura sofre aumento de volume com o aumento do índice de massa corporal do paciente (IMC) e, com o envelhecimento, torna-se aparente após aproximadamente 2 anos.

Fui informado sobre a importância dos retornos e comunicação através de envio de imagens para as revisões pós-operatórias, uso de compressão ou tape (micropore) e drenagem linfática, visando acelerar e melhorar o processo de reparação pós-procedimento.

Fui orientado(a) ainda que, mediante qualquer intercorrência descrita neste documento ou outras situações adversas, sejam de urgência ou não, deverei avisar imediatamente ao profissional que realizou o procedimento, que tomará as medidas necessárias para a minha proteção e controle de uma eventual complicação. Os profissionais se colocaram inteiramente à minha disposição para me ajudar e esclarecer qualquer dúvida.

Estou ciente de que posso no futuro necessitar de outros procedimentos para alcançar meu objetivo.

Me foi explicado que o resultado deste tipo de tratamento pode ser imediato em alguns casos, porém se torna mais visível após 30-60 dias (1 a 2 meses), com melhora progressiva em até 6 meses. Após este período, serei reavaliado para verificar se há necessidade de um novo procedimento com o objetivo de refinar o resultado, sendo que sua necessidade estará à critério e indicação do profissional.

Foi explicado que este tratamento acordado proporcionará um resultado específico e, em algumas situações motivadas pelo desejo do paciente ou por orientação profissional, podem ser necessários outros procedimentos adicionais que serão orçados e apresentados ao paciente no momento apropriado.

Estou ciente da minha colaboração no pós-operatório, tomando os cuidados necessários para um melhor resultado. Entendi que o resultado também depende do meu empenho e comprometimento em seguir todas as orientações que me foram prescritas e receitadas, incluindo medicações e cuidados, principalmente o uso de faixa, compressão ou tape (micropore) durante 24 (vinte e quatro) horas nos primeiros 4-7 dias após o procedimento e por + 4 dias somente à noite para dormir.

Esclareço que tive oportunidade de ler e entender os termos e palavras contidas neste termo, com explicações e oportunidade de fazer perguntas e tirar todas as dúvidas. Por aceitar o que me foi explicado e assumir todos os riscos inerentes ao procedimento descrito, que fazem parte da técnica, assino este termo juntamente com o profissional.

Pleno deste entendimento, autorizo a realização do procedimento proposto.

__DATA__

Declaro não ter nenhuma alteração de saúde até a presente data: __DATA__

Assinatura do paciente: _________________________

Profissional responsável: __PROFISSIONAL__ | __COREN__ _________________________
',
  true
)
ON CONFLICT (slug, version) DO NOTHING;

