-- =============================================================================
-- Modelo de procedimentos estéticos: globais + personalizados, sessões, resultados, fotos
-- =============================================================================

-- Procedimentos (globais pré-cadastrados ou personalizados por usuário)
CREATE TABLE public.procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_global BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT procedures_global_has_no_creator CHECK (is_global = false OR created_by IS NULL),
    CONSTRAINT procedures_slug_unique UNIQUE (slug, COALESCE(created_by, '00000000-0000-0000-0000-000000000000'::uuid))
);

COMMENT ON TABLE public.procedures IS 'Procedimentos estéticos: globais (sistema) ou personalizados (criados por usuário)';
CREATE INDEX idx_procedures_created_by ON public.procedures(created_by);
CREATE INDEX idx_procedures_is_global ON public.procedures(is_global);
CREATE INDEX idx_procedures_slug ON public.procedures(slug);
CREATE INDEX idx_procedures_category ON public.procedures(category);

CREATE TRIGGER update_procedures_updated_at
    BEFORE UPDATE ON public.procedures
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view global procedures and their own custom procedures"
    ON public.procedures FOR SELECT
    USING (is_global = true OR created_by = auth.uid());

CREATE POLICY "Users can insert custom procedures"
    ON public.procedures FOR INSERT
    WITH CHECK (is_global = false AND created_by = auth.uid());

CREATE POLICY "Users can update their own custom procedures"
    ON public.procedures FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own custom procedures"
    ON public.procedures FOR DELETE
    USING (created_by = auth.uid());

-- Campos dinâmicos por procedimento
CREATE TABLE public.procedure_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL,
    options JSONB DEFAULT '[]',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT procedure_fields_unique_key UNIQUE (procedure_id, field_key)
);

COMMENT ON TABLE public.procedure_fields IS 'Campos dinâmicos de cada procedimento (texto, número, seleção, boolean, imagem, data)';
CREATE INDEX idx_procedure_fields_procedure_id ON public.procedure_fields(procedure_id);

ALTER TABLE public.procedure_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fields of procedures they can view"
    ON public.procedure_fields FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.procedures p
            WHERE p.id = procedure_id AND (p.is_global = true OR p.created_by = auth.uid())
        )
    );

CREATE POLICY "Users can manage fields of their custom procedures"
    ON public.procedure_fields FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.procedures p WHERE p.id = procedure_id AND p.created_by = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.procedures p WHERE p.id = procedure_id AND p.created_by = auth.uid())
    );

-- Controle por usuário: ativar/desativar e visibilidade no menu e na criação de atendimentos
CREATE TABLE public.user_procedures (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    show_in_menu BOOLEAN NOT NULL DEFAULT true,
    show_in_appointments BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, procedure_id)
);

COMMENT ON TABLE public.user_procedures IS 'Controle de visibilidade e ativação de procedimentos por usuário';
CREATE INDEX idx_user_procedures_user_id ON public.user_procedures(user_id);
CREATE INDEX idx_user_procedures_procedure_id ON public.user_procedures(procedure_id);

CREATE TRIGGER update_user_procedures_updated_at
    BEFORE UPDATE ON public.user_procedures
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own user_procedures"
    ON public.user_procedures FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own user_procedures"
    ON public.user_procedures FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own user_procedures"
    ON public.user_procedures FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own user_procedures"
    ON public.user_procedures FOR DELETE
    USING (user_id = auth.uid());

-- Instância do procedimento (início de um procedimento para um paciente)
CREATE TABLE public.procedure_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'em_andamento',
    observacoes_gerais TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.procedure_instances IS 'Registro do início de um procedimento para um paciente';
CREATE INDEX idx_procedure_instances_procedure_id ON public.procedure_instances(procedure_id);
CREATE INDEX idx_procedure_instances_patient_id ON public.procedure_instances(patient_id);
CREATE INDEX idx_procedure_instances_professional_id ON public.procedure_instances(professional_id);
CREATE INDEX idx_procedure_instances_data_inicio ON public.procedure_instances(data_inicio DESC);

CREATE TRIGGER update_procedure_instances_updated_at
    BEFORE UPDATE ON public.procedure_instances
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.procedure_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can view procedure instances of their patients"
    ON public.procedure_instances FOR SELECT
    USING (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can insert procedure instances for their patients"
    ON public.procedure_instances FOR INSERT
    WITH CHECK (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can update procedure instances of their patients"
    ON public.procedure_instances FOR UPDATE
    USING (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can delete procedure instances of their patients"
    ON public.procedure_instances FOR DELETE
    USING (public.is_patient_owner(patient_id));

-- Sessões de uma instância do procedimento
CREATE TABLE public.procedure_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_instance_id UUID NOT NULL REFERENCES public.procedure_instances(id) ON DELETE CASCADE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.procedure_sessions IS 'Cada sessão de uma instância do procedimento (campos dinâmicos em data)';
CREATE INDEX idx_procedure_sessions_instance_id ON public.procedure_sessions(procedure_instance_id);
CREATE INDEX idx_procedure_sessions_session_date ON public.procedure_sessions(session_date DESC);

CREATE TRIGGER update_procedure_sessions_updated_at
    BEFORE UPDATE ON public.procedure_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.procedure_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can manage procedure_sessions of their patients"
    ON public.procedure_sessions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.procedure_instances pi
            WHERE pi.id = procedure_instance_id AND public.is_patient_owner(pi.patient_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.procedure_instances pi
            WHERE pi.id = procedure_instance_id AND public.is_patient_owner(pi.patient_id)
        )
    );

-- Resultados / evolução (avaliação por instância ou por sessão)
CREATE TABLE public.procedure_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_instance_id UUID NOT NULL REFERENCES public.procedure_instances(id) ON DELETE CASCADE,
    procedure_session_id UUID REFERENCES public.procedure_sessions(id) ON DELETE CASCADE,
    result_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.procedure_results IS 'Resultados ou avaliações de uma instância ou sessão do procedimento';
CREATE INDEX idx_procedure_results_instance_id ON public.procedure_results(procedure_instance_id);
CREATE INDEX idx_procedure_results_session_id ON public.procedure_results(procedure_session_id);

CREATE TRIGGER update_procedure_results_updated_at
    BEFORE UPDATE ON public.procedure_results
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.procedure_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can manage procedure_results of their patients"
    ON public.procedure_results FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.procedure_instances pi
            WHERE pi.id = procedure_instance_id AND public.is_patient_owner(pi.patient_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.procedure_instances pi
            WHERE pi.id = procedure_instance_id AND public.is_patient_owner(pi.patient_id)
        )
    );

-- Fotos (instância ou sessão)
CREATE TABLE public.procedure_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_instance_id UUID NOT NULL REFERENCES public.procedure_instances(id) ON DELETE CASCADE,
    procedure_session_id UUID REFERENCES public.procedure_sessions(id) ON DELETE CASCADE,
    photo_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.procedure_photos IS 'Fotos vinculadas à instância do procedimento ou a uma sessão';
CREATE INDEX idx_procedure_photos_instance_id ON public.procedure_photos(procedure_instance_id);
CREATE INDEX idx_procedure_photos_session_id ON public.procedure_photos(procedure_session_id);

ALTER TABLE public.procedure_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can manage procedure_photos of their patients"
    ON public.procedure_photos FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.procedure_instances pi
            WHERE pi.id = procedure_instance_id AND public.is_patient_owner(pi.patient_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.procedure_instances pi
            WHERE pi.id = procedure_instance_id AND public.is_patient_owner(pi.patient_id)
        )
    );
