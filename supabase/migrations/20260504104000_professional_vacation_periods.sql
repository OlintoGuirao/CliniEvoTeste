CREATE TABLE IF NOT EXISTS public.professional_vacation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT professional_vacation_periods_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_professional_vacation_periods_professional_id
  ON public.professional_vacation_periods(professional_id);

CREATE INDEX IF NOT EXISTS idx_professional_vacation_periods_start_date
  ON public.professional_vacation_periods(start_date);

DROP TRIGGER IF EXISTS professional_vacation_periods_updated_at ON public.professional_vacation_periods;
CREATE TRIGGER professional_vacation_periods_updated_at
  BEFORE UPDATE ON public.professional_vacation_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.professional_vacation_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional pode ver seus periodos de ferias" ON public.professional_vacation_periods;
CREATE POLICY "Profissional pode ver seus periodos de ferias"
  ON public.professional_vacation_periods
  FOR SELECT
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );

DROP POLICY IF EXISTS "Profissional pode gerir seus periodos de ferias" ON public.professional_vacation_periods;
CREATE POLICY "Profissional pode gerir seus periodos de ferias"
  ON public.professional_vacation_periods
  FOR ALL
  USING (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  )
  WITH CHECK (
    professional_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
  );
