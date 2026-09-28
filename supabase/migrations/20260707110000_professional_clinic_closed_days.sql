-- Dias em que a clínica fica fechada para pacientes (agenda pessoal do profissional).
CREATE TABLE IF NOT EXISTS public.professional_clinic_closed_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  closed_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT professional_clinic_closed_days_unique UNIQUE (professional_id, closed_date)
);

CREATE INDEX IF NOT EXISTS idx_professional_clinic_closed_days_professional_id
  ON public.professional_clinic_closed_days(professional_id);

CREATE INDEX IF NOT EXISTS idx_professional_clinic_closed_days_closed_date
  ON public.professional_clinic_closed_days(closed_date);

COMMENT ON TABLE public.professional_clinic_closed_days IS
  'Dias com clínica fechada para pacientes; o profissional usa a agenda apenas para bloqueios pessoais.';

DROP TRIGGER IF EXISTS professional_clinic_closed_days_updated_at ON public.professional_clinic_closed_days;
CREATE TRIGGER professional_clinic_closed_days_updated_at
  BEFORE UPDATE ON public.professional_clinic_closed_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.professional_clinic_closed_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional pode ver dias de clinica fechada" ON public.professional_clinic_closed_days;
CREATE POLICY "Profissional pode ver dias de clinica fechada"
  ON public.professional_clinic_closed_days
  FOR SELECT
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

DROP POLICY IF EXISTS "Profissional pode gerir dias de clinica fechada" ON public.professional_clinic_closed_days;
CREATE POLICY "Profissional pode gerir dias de clinica fechada"
  ON public.professional_clinic_closed_days
  FOR ALL
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  )
  WITH CHECK (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );
