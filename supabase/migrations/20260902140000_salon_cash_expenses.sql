-- Fluxo de caixa do salão: despesas fixas e variáveis (exclusivo account_type salon).

CREATE TABLE IF NOT EXISTS public.salon_cash_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expense_kind text NOT NULL CHECK (expense_kind IN ('fixed', 'variable')),
  title text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salon_cash_expenses_title_not_empty CHECK (length(trim(title)) >= 1)
);

CREATE INDEX IF NOT EXISTS salon_cash_expenses_org_date_idx
  ON public.salon_cash_expenses (organization_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS salon_cash_expenses_org_kind_date_idx
  ON public.salon_cash_expenses (organization_id, expense_kind, expense_date DESC);

COMMENT ON TABLE public.salon_cash_expenses IS
  'Despesas fixas/variáveis do fluxo de caixa — somente organizações tipo salon.';
COMMENT ON COLUMN public.salon_cash_expenses.expense_kind IS
  'fixed = despesa fixa; variable = despesa variável.';

DROP TRIGGER IF EXISTS salon_cash_expenses_updated_at ON public.salon_cash_expenses;
CREATE TRIGGER salon_cash_expenses_updated_at
  BEFORE UPDATE ON public.salon_cash_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.salon_cash_expenses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_salon_organization_id(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  INNER JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = p_user_id
    AND o.type = 'salon'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.user_salon_organization_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_salon_organization_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_salon_organization_id(uuid) TO service_role;

DROP POLICY IF EXISTS "Salon members read cash expenses" ON public.salon_cash_expenses;
CREATE POLICY "Salon members read cash expenses"
  ON public.salon_cash_expenses
  FOR SELECT
  TO authenticated
  USING (organization_id = public.user_salon_organization_id(auth.uid()));

DROP POLICY IF EXISTS "Salon members insert cash expenses" ON public.salon_cash_expenses;
CREATE POLICY "Salon members insert cash expenses"
  ON public.salon_cash_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.user_salon_organization_id(auth.uid())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Salon members update cash expenses" ON public.salon_cash_expenses;
CREATE POLICY "Salon members update cash expenses"
  ON public.salon_cash_expenses
  FOR UPDATE
  TO authenticated
  USING (organization_id = public.user_salon_organization_id(auth.uid()))
  WITH CHECK (organization_id = public.user_salon_organization_id(auth.uid()));

DROP POLICY IF EXISTS "Salon members delete cash expenses" ON public.salon_cash_expenses;
CREATE POLICY "Salon members delete cash expenses"
  ON public.salon_cash_expenses
  FOR DELETE
  TO authenticated
  USING (organization_id = public.user_salon_organization_id(auth.uid()));

-- Admin do salão lê insumos da equipe no fluxo de caixa consolidado.
DROP POLICY IF EXISTS "Org owners read team insumos" ON public.insumo_entradas_nf;
CREATE POLICY "Org owners read team insumos"
  ON public.insumo_entradas_nf
  FOR SELECT
  TO authenticated
  USING (public.is_org_team_professional(professional_id));
