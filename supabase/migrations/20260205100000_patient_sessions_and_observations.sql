-- =============================================================================
-- Sessões por paciente + observações + múltiplos procedimentos por sessão
-- Compatível com dados atuais: procedure_sessions sem patient_session_id
-- =============================================================================

-- Sessão do paciente (ficha única por paciente, várias sessões)
CREATE TABLE public.patient_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.patient_sessions IS 'Sessão de atendimento do paciente; pode agrupar vários procedimentos no mesmo dia';
CREATE INDEX idx_patient_sessions_patient_id ON public.patient_sessions(patient_id);
CREATE INDEX idx_patient_sessions_professional_id ON public.patient_sessions(professional_id);
CREATE INDEX idx_patient_sessions_session_date ON public.patient_sessions(session_date DESC);

CREATE TRIGGER update_patient_sessions_updated_at
    BEFORE UPDATE ON public.patient_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.patient_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can manage patient_sessions of their patients"
    ON public.patient_sessions FOR ALL
    USING (public.is_patient_owner(patient_id))
    WITH CHECK (public.is_patient_owner(patient_id));

-- Vincular procedure_sessions a uma sessão do paciente (opcional; compatível com dados antigos)
ALTER TABLE public.procedure_sessions
    ADD COLUMN IF NOT EXISTS patient_session_id UUID REFERENCES public.patient_sessions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.procedure_sessions.patient_session_id IS 'Quando preenchido, esta sessão de procedimento faz parte desta sessão do paciente (múltiplos procedimentos por sessão)';
CREATE INDEX IF NOT EXISTS idx_procedure_sessions_patient_session_id ON public.procedure_sessions(patient_session_id);

-- Observações por sessão de procedimento (histórico; além do JSON data)
ALTER TABLE public.procedure_sessions
    ADD COLUMN IF NOT EXISTS observacoes TEXT;

COMMENT ON COLUMN public.procedure_sessions.observacoes IS 'Observações em texto livre da sessão deste procedimento; histórico mantido por registro';
