-- Master da clínica pode criar settings WhatsApp ao cadastrar filial (sem depender da API local).

CREATE POLICY "Clinic owner inserts branch whatsapp settings"
  ON public.branch_whatsapp_settings
  FOR INSERT
  WITH CHECK (public.user_can_access_branch(branch_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.ensure_branch_whatsapp_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.branch_whatsapp_settings (branch_id)
  VALUES (NEW.id)
  ON CONFLICT (branch_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_branches_whatsapp_settings ON public.organization_branches;
CREATE TRIGGER organization_branches_whatsapp_settings
  AFTER INSERT ON public.organization_branches
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_branch_whatsapp_settings();
