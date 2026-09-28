-- Ao excluir orçamento vinculado a plano odontológico:
-- limpa budget_quote_id (já via ON DELETE SET NULL) e reabre o plano
-- se estava em negociação (evita plano travado sem orçamento).

CREATE OR REPLACE FUNCTION public.dental_plans_on_budget_quote_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.dental_treatment_plans
  SET
    budget_quote_id = NULL,
    status = CASE
      WHEN authorization_code IS NOT NULL AND trim(authorization_code) <> '' THEN 'authorized'
      ELSE 'open'
    END,
    updated_at = now()
  WHERE budget_quote_id = OLD.id
    AND status = 'negotiating';

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS dental_plans_on_budget_quote_deleted ON public.budget_quotes;
CREATE TRIGGER dental_plans_on_budget_quote_deleted
  BEFORE DELETE ON public.budget_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.dental_plans_on_budget_quote_deleted();

COMMENT ON FUNCTION public.dental_plans_on_budget_quote_deleted() IS
  'Reabre plano odontológico em negociação quando o orçamento vinculado é excluído.';

-- Corrige planos já órfãos (orçamento sumiu / SET NULL sem reabrir status).
UPDATE public.dental_treatment_plans
SET
  status = CASE
    WHEN authorization_code IS NOT NULL AND trim(authorization_code) <> '' THEN 'authorized'
    ELSE 'open'
  END,
  updated_at = now()
WHERE status = 'negotiating'
  AND budget_quote_id IS NULL;
