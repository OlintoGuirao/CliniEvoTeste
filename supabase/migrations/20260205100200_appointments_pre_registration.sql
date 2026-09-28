-- =============================================================================
-- Pré-cadastro para agendamento: permitir agendar só com nome completo
-- patient_id opcional; completar cadastro depois
-- =============================================================================

-- Remover NOT NULL de patient_id e adicionar full_name para pré-cadastro
ALTER TABLE public.appointments
    ALTER COLUMN patient_id DROP NOT NULL;

ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS full_name TEXT;

COMMENT ON COLUMN public.appointments.full_name IS 'Nome completo para pré-cadastro; quando patient_id for preenchido, pode espelhar patients.full_name';

-- Garantir que ao menos um dos dois exista
ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_patient_or_name CHECK (
        (patient_id IS NOT NULL) OR (full_name IS NOT NULL AND trim(full_name) <> '')
    );

-- Índice para buscar agendamentos por nome (pré-cadastro)
CREATE INDEX IF NOT EXISTS idx_appointments_full_name
    ON public.appointments(professional_id, lower(trim(full_name)))
    WHERE full_name IS NOT NULL;
