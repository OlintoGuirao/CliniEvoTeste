-- Migração: dados de weight_loss_programs / weight_loss_sessions / patient_photos
-- para procedure_instances / procedure_sessions / procedure_photos (procedimento Emagrecimento)
-- ID do procedimento Emagrecimento / Redução de Medidas: a1000000-0000-4000-8000-000000000001

-- Garantir que o procedimento "Emagrecimento" existe (caso o seed não tenha sido aplicado)
INSERT INTO public.procedures (id, is_global, created_by, category, name, description, slug, is_active)
SELECT
    'a1000000-0000-4000-8000-000000000001'::uuid,
    true,
    NULL,
    'ESTÉTICA CORPORAL',
    'Emagrecimento / Redução de Medidas',
    'Controle de peso, IMC, medidas e fotos antes/depois',
    'emagrecimento-reducao-medidas',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM public.procedures
    WHERE slug = 'emagrecimento-reducao-medidas' AND is_global = true
);

-- ID do procedimento (pode ser o que acabamos de inserir ou o que já existia com outro UUID)
CREATE TEMP TABLE _mig_procedure_id (id UUID PRIMARY KEY);
INSERT INTO _mig_procedure_id (id)
SELECT id FROM public.procedures
WHERE slug = 'emagrecimento-reducao-medidas' AND is_global = true
LIMIT 1;

-- Tabelas temporárias para mapeamento (program_id → instance_id, old_session_id → new_session_id)
CREATE TEMP TABLE IF NOT EXISTS _mig_program_to_instance (
    program_id UUID PRIMARY KEY,
    instance_id UUID NOT NULL
);

CREATE TEMP TABLE IF NOT EXISTS _mig_session_mapping (
    old_session_id UUID PRIMARY KEY,
    new_session_id UUID NOT NULL
);

-- 1) Inserir procedure_instances e popular mapeamento program_id → instance_id (ordem por program_id para parear)
WITH wlp_ordered AS (
    SELECT wlp.id AS program_id, wlp.patient_id, p.professional_id, wlp.created_at, wlp.updated_at, wlp.notes,
           row_number() OVER (ORDER BY wlp.id) AS rn
    FROM public.weight_loss_programs wlp
    JOIN public.patients p ON p.id = wlp.patient_id
),
ins AS (
    INSERT INTO public.procedure_instances (
        procedure_id,
        patient_id,
        professional_id,
        data_inicio,
        status,
        observacoes_gerais,
        created_at,
        updated_at
    )
    SELECT
        (SELECT id FROM _mig_procedure_id LIMIT 1),
        w.patient_id,
        w.professional_id,
        (w.created_at AT TIME ZONE 'UTC')::date,
        'em_andamento',
        w.notes,
        w.created_at,
        w.updated_at
    FROM wlp_ordered w
    ORDER BY w.rn
    RETURNING id
),
ins_rn AS (
    SELECT id, row_number() OVER (ORDER BY id) AS rn FROM ins
)
INSERT INTO _mig_program_to_instance (program_id, instance_id)
SELECT w.program_id, i.id
FROM wlp_ordered w
JOIN ins_rn i ON i.rn = w.rn;

-- 2) Sessão “inicial” por programa (dados iniciais)
INSERT INTO public.procedure_sessions (
    procedure_instance_id,
    session_date,
    data,
    created_at,
    updated_at
)
SELECT
    p2i.instance_id,
    (wlp.created_at AT TIME ZONE 'UTC')::date,
    jsonb_build_object(
        'peso_inicial', wlp.initial_weight,
        'altura_cm', wlp.height,
        'cintura_cm', wlp.initial_waist,
        'abdomen_cm', wlp.initial_abdomen,
        'quadril_cm', wlp.initial_hip,
        'coxa_cm', wlp.initial_thigh,
        'braco_cm', wlp.initial_arm
    ),
    wlp.created_at,
    wlp.updated_at
FROM public.weight_loss_programs wlp
JOIN _mig_program_to_instance p2i ON p2i.program_id = wlp.id;

-- 3) Inserir procedure_sessions a partir de weight_loss_sessions e mapear old_session_id → new_session_id
WITH wls AS (
    SELECT id, program_id, session_date, current_weight, waist, abdomen, hip, thigh, arm,
           body_fat_percentage, professional_notes, patient_feedback, created_at, updated_at
    FROM public.weight_loss_sessions
),
ins AS (
    INSERT INTO public.procedure_sessions (
        procedure_instance_id,
        session_date,
        data,
        created_at,
        updated_at
    )
    SELECT
        p2i.instance_id,
        w.session_date,
        jsonb_build_object(
            'peso_atual', w.current_weight,
            'cintura_cm', w.waist,
            'abdomen_cm', w.abdomen,
            'quadril_cm', w.hip,
            'coxa_cm', w.thigh,
            'braco_cm', w.arm,
            'gordura_corporal_percentual', w.body_fat_percentage,
            'professional_notes', w.professional_notes,
            'patient_feedback', w.patient_feedback
        ),
        w.created_at,
        w.updated_at
    FROM wls w
    JOIN _mig_program_to_instance p2i ON p2i.program_id = w.program_id
    RETURNING id, procedure_instance_id, session_date, created_at
)
INSERT INTO _mig_session_mapping (old_session_id, new_session_id)
SELECT DISTINCT ON (w.id) w.id, i.id
FROM wls w
JOIN _mig_program_to_instance p2i ON p2i.program_id = w.program_id
JOIN ins i ON i.procedure_instance_id = p2i.instance_id
  AND i.session_date = w.session_date
  AND i.created_at = w.created_at
ORDER BY w.id, i.id;

-- 4) Inserir procedure_photos a partir de patient_photos (emagrecimento: exclui botox)
INSERT INTO public.procedure_photos (
    procedure_instance_id,
    procedure_session_id,
    photo_type,
    file_url,
    created_at
)
SELECT
    p2i.instance_id,
    COALESCE(sm.new_session_id, NULL),
    pp.photo_type,
    pp.file_url,
    COALESCE(pp.taken_at, pp.created_at)
FROM public.patient_photos pp
JOIN public.weight_loss_programs wlp ON wlp.patient_id = pp.patient_id
JOIN _mig_program_to_instance p2i ON p2i.program_id = wlp.id
LEFT JOIN _mig_session_mapping sm ON sm.old_session_id = pp.weight_loss_session_id
WHERE pp.botox_application_id IS NULL;

-- Limpar temp tables (opcional; em sessão são descartadas ao fim)
DROP TABLE IF EXISTS _mig_session_mapping;
DROP TABLE IF EXISTS _mig_program_to_instance;
DROP TABLE IF EXISTS _mig_procedure_id;

-- Após validar os dados migrados, você pode (opcionalmente) desativar ou remover
-- as tabelas antigas. Não removemos aqui para evitar perda acidental de dados.
