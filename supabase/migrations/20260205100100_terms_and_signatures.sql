-- =============================================================================
-- Termos versionados e assinaturas digitais (paciente, sessão, data, versão)
-- =============================================================================

-- Termos (versionados por slug)
CREATE TABLE public.terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT terms_slug_version_unique UNIQUE (slug, version)
);

COMMENT ON TABLE public.terms IS 'Termos versionados (LGPD, consentimento, etc.)';
CREATE INDEX idx_terms_slug ON public.terms(slug);
CREATE INDEX idx_terms_active ON public.terms(active) WHERE active = true;

CREATE TRIGGER update_terms_updated_at
    BEFORE UPDATE ON public.terms
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active terms"
    ON public.terms FOR SELECT
    USING (auth.role() = 'authenticated' AND active = true);

-- Apenas admins/profissionais podem gerenciar termos (ajustar conforme seu role)
CREATE POLICY "Users can manage terms"
    ON public.terms FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Assinaturas digitais (paciente, sessão opcional, termo, data, imagem)
CREATE TABLE public.term_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    patient_session_id UUID REFERENCES public.patient_sessions(id) ON DELETE SET NULL,
    procedure_session_id UUID REFERENCES public.procedure_sessions(id) ON DELETE SET NULL,
    term_id UUID NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
    signature_data TEXT NOT NULL,
    signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.term_signatures IS 'Assinaturas digitais (touch); vinculadas a paciente, sessão (opcional), data e versão do termo';
CREATE INDEX idx_term_signatures_patient_id ON public.term_signatures(patient_id);
CREATE INDEX idx_term_signatures_term_id ON public.term_signatures(term_id);
CREATE INDEX idx_term_signatures_patient_session_id ON public.term_signatures(patient_session_id);
CREATE INDEX idx_term_signatures_signed_at ON public.term_signatures(signed_at DESC);

ALTER TABLE public.term_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can manage term_signatures of their patients"
    ON public.term_signatures FOR ALL
    USING (public.is_patient_owner(patient_id))
    WITH CHECK (public.is_patient_owner(patient_id));
