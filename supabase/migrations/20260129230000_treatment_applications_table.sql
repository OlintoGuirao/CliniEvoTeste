-- Tabela genérica de aplicações por tipo de procedimento
-- Qualquer novo tipo cadastrado em treatment_types pode registrar aplicações aqui,
-- sem precisar criar uma nova tabela no banco.
CREATE TABLE public.treatment_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    treatment_type_id UUID NOT NULL REFERENCES public.treatment_types(id) ON DELETE CASCADE,
    application_date DATE NOT NULL DEFAULT CURRENT_DATE,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.treatment_applications IS 'Aplicações/sessões de qualquer tipo de procedimento (campos dinâmicos em data conforme field_definitions do tipo)';
COMMENT ON COLUMN public.treatment_applications.data IS 'Valores dos campos definidos em treatment_types.field_definitions (ex: áreas, produto, unidades, observações)';

CREATE TRIGGER update_treatment_applications_updated_at
    BEFORE UPDATE ON public.treatment_applications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.treatment_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can view treatment applications of their patients"
    ON public.treatment_applications FOR SELECT
    USING (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can insert treatment applications for their patients"
    ON public.treatment_applications FOR INSERT
    WITH CHECK (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can update treatment applications of their patients"
    ON public.treatment_applications FOR UPDATE
    USING (public.is_patient_owner(patient_id));

CREATE POLICY "Professionals can delete treatment applications of their patients"
    ON public.treatment_applications FOR DELETE
    USING (public.is_patient_owner(patient_id));

CREATE INDEX idx_treatment_applications_patient_id ON public.treatment_applications(patient_id);
CREATE INDEX idx_treatment_applications_treatment_type_id ON public.treatment_applications(treatment_type_id);
CREATE INDEX idx_treatment_applications_application_date ON public.treatment_applications(application_date DESC);
