-- =============================================================================
-- Termos de consentimento (Botox e Preenchedores) + Tabela Anamnese Orofacial
-- =============================================================================

-- Tabela: anamnese orofacial por paciente (dados do formulário + assinatura)
CREATE TABLE IF NOT EXISTS public.patient_anamnese (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    signature_data TEXT,
    signed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT patient_anamnese_patient_unique UNIQUE (patient_id)
);

COMMENT ON TABLE public.patient_anamnese IS 'Anamnese orofacial: dados do formulário e assinatura do paciente';
CREATE INDEX IF NOT EXISTS idx_patient_anamnese_patient_id ON public.patient_anamnese(patient_id);

DROP TRIGGER IF EXISTS update_patient_anamnese_updated_at ON public.patient_anamnese;
CREATE TRIGGER update_patient_anamnese_updated_at
    BEFORE UPDATE ON public.patient_anamnese
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.patient_anamnese ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Professionals can manage anamnese of their patients" ON public.patient_anamnese;
CREATE POLICY "Professionals can manage anamnese of their patients"
    ON public.patient_anamnese FOR ALL
    USING (public.is_patient_owner(patient_id))
    WITH CHECK (public.is_patient_owner(patient_id));

-- Seed: Termo de consentimento - Toxina Botulínica (placeholders: __NOME_PACIENTE__, __CPF__, __DATA__, __PROFISSIONAL__, __COREN__)
INSERT INTO public.terms (slug, version, title, body, active)
VALUES (
  'consentimento-botox',
  1,
  'TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO - TOXINA BOTULÍNICA',
  E'Eu, __NOME_PACIENTE__, portador(a) do CPF __CPF__, em pleno gozo de minhas faculdades mentais, livre e voluntariamente, aceito o tratamento com toxina botulínica a ser realizado por __PROFISSIONAL__, habilitado(a) para tal procedimento e portador(a) do __COREN__.\n\nDeclaro que recebi esclarecimentos quanto ao uso da toxina botulínica na terapêutica e estou ciente de que a mesma tem ação temporária e que cada pessoa apresenta uma resposta individual ao efeito de estiramento e paralisação muscular.\n\nDeclaro que estou ciente dos transtornos possíveis tais como: reação alérgica, hipoestesia transitória (estímulos táteis abaixo do normal), dor e edema no local da aplicação, eritema (vermelhidão da pele), hematomas, entorpecimento temporário (fraqueza), náusea, dor de cabeça, extensão do local, paralisação indesejada de músculos adjacentes, xerostomia (secura excessiva da boca e alteração de voz).\n\nÉ de meu conhecimento também que posso não fazer o uso da toxina botulínica e optar por outro tipo de tratamento, como fui orientado(a) pelo(a) profissional.\n\nDeclaro que recebi explicações verbais sobre a natureza e propósitos do procedimento, assim como benefícios, riscos, alternativas e meios de tratamento. Estou ciente de que, para obter o melhor resultado, devo ficar sem abaixar a cabeça e sem realizar qualquer esforço físico durante quatro horas, assim como evitar apoiar as mãos sobre o rosto ou coçar as regiões que passaram por aplicações, pelo mesmo período de tempo e ainda, evitar atividades que possam provocar aquecimento (aplicar calor na face, consumo de álcool, exercício físico por 24h e exposição ao sol).\n\nDeclaro que respondi à anamnese (exame clínico e questionamentos de saúde) e não apresento alergia a ovo (albumina), problemas de miastenia grave (esclerose múltipla), acne, depressão, dismorfofobia, bem como nenhuma enfermidade descompensatória ou descompensada.\n\nDeclaro que entendi e estou satisfeito(a) com todas as explicações e esclarecimentos fornecidos pelo(a) profissional sobre o procedimento mencionado e que posso desistir a qualquer momento antes do início do procedimento.\n\nÉ de meu conhecimento que a prática das ciências médicas não é uma ciência exata e reconheço que o prognóstico é apenas de ordem estatística não significando necessariamente o resultado.\n\nAssim sendo, reafirmo o meu consentimento para que seja utilizada a toxina botulínica e afirmo que o(a) profissional colocou-se à minha disposição para esclarecer dúvidas ou ampliar informações caso eu demonstre interesse.\n\nE para que conste, assino o presente documento.\n\n__DATA__\n\nAssinatura do Paciente _________________________',
  true
)
ON CONFLICT (slug, version) DO NOTHING;

-- Seed: Termo de consentimento - Preenchedores
INSERT INTO public.terms (slug, version, title, body, active)
VALUES (
  'consentimento-preenchedores',
  1,
  'TERMO DE CONSENTIMENTO INFORMADO DE PREENCHEDORES',
  E'Profissional: __PROFISSIONAL__ | __COREN__\n\nDADOS DO PACIENTE\nNome Completo: __NOME_PACIENTE__ | Idade: __IDADE__ | Tel/Cel: __TELEFONE__ | Cidade: __CIDADE__\nEndereço: __ENDERECO__\n\nProcedimento (marque):\n( ) Preenchimento facial para rugas finas e lábios\n( ) Preenchimento facial para rugas médias e profundas\n( ) Preenchimento facial para rugas profundas e muito profundas\n( ) Preenchimento facial para rugas muito profundas e contorno facial\n\nPelo presente instrumento declaro que fui devidamente informado e esclarecido sobre o procedimento e orientado sobre os riscos e benefícios decorrentes do mesmo, de acordo com as diretrizes estabelecidas pelo fabricante e que por diversos fatores o resultado esperado não pode ser sempre garantido.\n\nDeclaro que antes do tratamento fui devidamente informado(a) e recebi as orientações sobre o procedimento, riscos, benefícios e resultados conforme descrito abaixo. Informo também que não omiti ou adulterei informações sobre meu histórico de hipersensibilidade, alergia e antecedentes clínicos.\n\nRESULTADOS\nA duração do resultado pode variar de acordo com cada indivíduo, isso ocorre porque cada organismo reage de maneira diferente. O produto é altamente seguro e sua qualidade está confirmada através de estudos clínicos. De acordo com o estabelecido pelo fabricante, após a aplicação do produto é possível que ocorram efeitos adversos tais como: inchaço, sangramento, inflamação e dor, o que em sua maioria são transitórios e reversíveis.\n\nCONTRAINDICAÇÕES\nPacientes que apresentam pele com algum tipo de disfunção, regiões inflamadas ou infectadas e pacientes que apresentam hipersensibilidade a qualquer componente da formulação do produto. É imprescindível que durante a anamnese o paciente informe ao profissional todo seu histórico clínico.\n\nORIENTAÇÕES GERAIS\nO profissional deverá ser informado sobre o uso de qualquer medicamento que o paciente faça uso. Medicamentos anestésicos de uso tópico ou injetável podem ser administrados desde que o paciente não apresente histórico de alergia ou hipersensibilidade aos componentes da fórmula. Na semana anterior ao procedimento evitar o uso de: ácido acetilsalicílico, altas quantidades de vitamina C, anti-inflamatórios e anticoagulantes.\n\nAssumo ter lido este termo de consentimento e entendo totalmente seu conteúdo. Autorizo o profissional a realizar em mim o procedimento.\n\n__DATA__\n\nAssinatura do Paciente _________________________',
  true
)
ON CONFLICT (slug, version) DO NOTHING;
