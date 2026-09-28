-- =============================================================================
-- Lembretes de reaplicação de Botox: prazo, notificação, agenda
-- =============================================================================

CREATE TABLE public.botox_reapplication_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    procedure_instance_id UUID REFERENCES public.procedure_instances(id) ON DELETE SET NULL,
    procedure_session_id UUID REFERENCES public.procedure_sessions(id) ON DELETE SET NULL,
    professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    notified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.botox_reapplication_reminders IS 'Prazo de reaplicação Botox; notificação ao profissional; ao confirmar abre agenda e pode enviar mensagem ao paciente';
CREATE INDEX idx_botox_reminders_patient_id ON public.botox_reapplication_reminders(patient_id);
CREATE INDEX idx_botox_reminders_professional_id ON public.botox_reapplication_reminders(professional_id);
CREATE INDEX idx_botox_reminders_due_date ON public.botox_reapplication_reminders(due_date) WHERE notified_at IS NULL;

CREATE TRIGGER update_botox_reapplication_reminders_updated_at
    BEFORE UPDATE ON public.botox_reapplication_reminders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.botox_reapplication_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can manage their own botox reminders"
    ON public.botox_reapplication_reminders FOR ALL
    USING (professional_id = auth.uid())
    WITH CHECK (professional_id = auth.uid());
