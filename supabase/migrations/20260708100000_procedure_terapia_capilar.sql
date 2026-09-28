-- =============================================================================
-- Procedimento global: Terapia Capilar (categoria Injetáveis)
-- =============================================================================

INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT gen_random_uuid(), true, NULL, 'Injetáveis', 'Terapia Capilar', 'Avaliação capilar, protocolo injetável e registro de sessões.', 'terapia-capilar', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p
  WHERE p.slug = 'terapia-capilar' AND p.is_global = true
);

INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, v.field_key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.procedures p
CROSS JOIN (VALUES
  -- Fotos
  ('foto_antes_sessao', 'Foto — Antes', 'image', '[]', 1),
  ('foto_durante_sessao', 'Foto — Durante', 'image', '[]', 2),

  -- Avaliação inicial
  ('queixa_principal', 'Queixa principal', 'text', '[]', 10),
  ('objetivo_tratamento', 'Objetivo do tratamento', 'text', '[]', 11),
  ('diagnostico_capilar', 'Diagnóstico capilar', 'text', '[]', 12),
  ('tipo_couro_cabeludo', 'Tipo de couro cabeludo', 'select', '["Oleoso","Seco","Normal","Misto","Sensível"]', 13),
  ('tipo_cabelo', 'Tipo de cabelo', 'select', '["Liso","Ondulado","Cacheado","Crespo"]', 14),
  ('grau_queda', 'Grau da queda', 'select', '["Leve","Moderada","Intensa"]', 15),
  ('tempo_queda_meses', 'Tempo da queda (meses)', 'number', '[]', 16),
  ('historico_familiar_calvicie', 'Histórico familiar de calvície', 'boolean', '[]', 17),
  ('doencas', 'Doenças', 'text', '[]', 18),
  ('uso_medicamentos', 'Uso de medicamentos', 'text', '[]', 19),
  ('alergias', 'Alergias', 'text', '[]', 20),
  ('estresse', 'Estresse', 'text', '[]', 21),
  ('alimentacao', 'Alimentação', 'text', '[]', 22),
  ('qualidade_sono', 'Qualidade do sono', 'text', '[]', 23),

  -- Avaliação do couro cabeludo
  ('oleosidade_couro', 'Oleosidade do couro cabeludo', 'select', '["Baixa","Média","Alta"]', 30),
  ('caspa', 'Caspa', 'select', '["Ausente","Leve","Moderada","Intensa"]', 31),
  ('descamacao', 'Descamação', 'boolean', '[]', 32),
  ('vermelhidao', 'Vermelhidão', 'boolean', '[]', 33),
  ('coceira', 'Coceira', 'boolean', '[]', 34),
  ('sensibilidade', 'Sensibilidade', 'boolean', '[]', 35),
  ('dermatite', 'Dermatite', 'boolean', '[]', 36),
  ('psoriase', 'Psoríase', 'boolean', '[]', 37),
  ('seborreia', 'Seborreia', 'boolean', '[]', 38),
  ('foliculite', 'Foliculite', 'boolean', '[]', 39),

  -- Avaliação dos fios
  ('espessura_fios', 'Espessura dos fios', 'select', '["Fino","Médio","Grosso"]', 40),
  ('densidade_fios', 'Densidade dos fios', 'select', '["Baixa","Média","Alta"]', 41),
  ('quebra_fios', 'Quebra', 'boolean', '[]', 42),
  ('ressecamento', 'Ressecamento', 'boolean', '[]', 43),
  ('elasticidade', 'Elasticidade', 'text', '[]', 44),
  ('brilho', 'Brilho', 'text', '[]', 45),
  ('pontas_duplas', 'Pontas duplas', 'boolean', '[]', 46),

  -- Protocolo aplicado
  ('tecnica_utilizada', 'Técnica utilizada', 'select', '["Mesoterapia capilar","Microagulhamento","Infusão de ativos","PRP","LED terapia","Laser de baixa potência","Drug delivery","Outra"]', 50),
  ('produtos_utilizados', 'Produtos utilizados', 'select_multi', '["Minoxidil","Finasterida tópica","Biotina","Complexo vitamínico","Peptídeos","Ácido hialurônico","Dutasterida tópica","Cafeína","Outro"]', 51),
  ('equipamentos_utilizados', 'Equipamentos utilizados', 'select_multi', '["Dermapen","Roller","Gun de mesoterapia","LED","Laser","Ultrassom","Outro"]', 52),
  ('tempo_aplicacao_min', 'Tempo de aplicação (min)', 'number', '[]', 53),
  ('frequencia_recomendada', 'Frequência recomendada', 'text', '[]', 54),

  -- Registro da sessão
  ('sessao_numero', 'Sessão nº', 'number', '[]', 60),
  ('evolucao_observada', 'Evolução observada', 'text', '[]', 61),
  ('resposta_tratamento', 'Resposta ao tratamento', 'text', '[]', 62),
  ('intercorrencias', 'Intercorrências', 'text', '[]', 63),
  ('orientacoes_paciente', 'Orientações ao paciente', 'text', '[]', 64),
  ('proximo_retorno', 'Próximo retorno', 'date', '[]', 65),

  -- Escalas (0 a 10)
  ('queda_percebida_0_10', 'Queda percebida (0 a 10)', 'number', '[]', 70),
  ('oleosidade_0_10', 'Oleosidade (0 a 10)', 'number', '[]', 71),
  ('satisfacao_paciente_0_10', 'Satisfação do paciente (0 a 10)', 'number', '[]', 72),
  ('crescimento_percebido_0_10', 'Crescimento percebido (0 a 10)', 'number', '[]', 73),

  ('foto_depois_sessao', 'Foto — Depois', 'image', '[]', 90),
  ('observacoes', 'Observações', 'text', '[]', 99)
) AS v(field_key, label, field_type, options, sort_order)
WHERE p.slug = 'terapia-capilar' AND p.is_global = true
ON CONFLICT (procedure_id, field_key) DO UPDATE
SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  options = EXCLUDED.options,
  sort_order = EXCLUDED.sort_order;
