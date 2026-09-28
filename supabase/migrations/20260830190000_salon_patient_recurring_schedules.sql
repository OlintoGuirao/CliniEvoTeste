-- Horário fixo semanal do cliente no salão (vínculo com agenda).

CREATE TABLE IF NOT EXISTS public.salon_patient_recurring_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  salon_procedure_id uuid NOT NULL REFERENCES public.salon_procedures(id) ON DELETE RESTRICT,
  weekday smallint NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time time NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salon_recurring_period_valid CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS salon_recurring_schedules_patient_idx
  ON public.salon_patient_recurring_schedules (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS salon_recurring_schedules_org_idx
  ON public.salon_patient_recurring_schedules (organization_id);

COMMENT ON TABLE public.salon_patient_recurring_schedules IS
  'Horário fixo semanal de atendimento do cliente no salão (gera agendamentos em massa).';

COMMENT ON COLUMN public.salon_patient_recurring_schedules.weekday IS
  '0=domingo … 6=sábado (mesmo padrão de Date.getDay() no JS).';

ALTER TABLE public.salon_patient_recurring_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Salon can read recurring schedules for accessible patients"
  ON public.salon_patient_recurring_schedules;
CREATE POLICY "Salon can read recurring schedules for accessible patients"
  ON public.salon_patient_recurring_schedules
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND o.type = 'salon'
    )
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id
        AND (
          p.professional_id = auth.uid()
          OR public.is_org_team_professional(p.professional_id)
        )
    )
  );

DROP POLICY IF EXISTS "Salon can insert recurring schedules for accessible patients"
  ON public.salon_patient_recurring_schedules;
CREATE POLICY "Salon can insert recurring schedules for accessible patients"
  ON public.salon_patient_recurring_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND o.type = 'salon'
    )
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id
        AND (
          p.professional_id = auth.uid()
          OR public.is_org_team_professional(p.professional_id)
        )
    )
    AND (
      professional_id = auth.uid()
      OR public.is_org_team_professional(professional_id)
    )
  );

DROP POLICY IF EXISTS "Salon can delete recurring schedules for accessible patients"
  ON public.salon_patient_recurring_schedules;
CREATE POLICY "Salon can delete recurring schedules for accessible patients"
  ON public.salon_patient_recurring_schedules
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND o.type = 'salon'
    )
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id
        AND (
          p.professional_id = auth.uid()
          OR public.is_org_team_professional(p.professional_id)
        )
    )
  );

GRANT SELECT, INSERT, DELETE ON public.salon_patient_recurring_schedules TO authenticated;
GRANT ALL ON public.salon_patient_recurring_schedules TO service_role;
