-- Admin de clínica/salão pode gerenciar agenda e clientes dos membros da equipe.

CREATE OR REPLACE FUNCTION public.is_org_team_professional(
  p_professional_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om_actor
    JOIN public.organization_members om_pro
      ON om_pro.organization_id = om_actor.organization_id
    JOIN public.organizations o
      ON o.id = om_actor.organization_id
    WHERE om_actor.user_id = p_actor_id
      AND om_actor.role = 'owner'
      AND om_pro.user_id = p_professional_id
      AND o.type IN ('clinic', 'salon')
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_team_professional(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_team_professional(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_team_professional(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.is_org_team_professional IS
  'True se p_actor é owner e p_professional_id é membro da mesma org clinic/salon.';

DROP POLICY IF EXISTS "Org owners manage team appointments" ON public.appointments;
CREATE POLICY "Org owners manage team appointments"
  ON public.appointments
  FOR ALL
  TO authenticated
  USING (public.is_org_team_professional(professional_id))
  WITH CHECK (public.is_org_team_professional(professional_id));

DROP POLICY IF EXISTS "Org owners manage team patients" ON public.patients;
CREATE POLICY "Org owners manage team patients"
  ON public.patients
  FOR ALL
  TO authenticated
  USING (public.is_org_team_professional(professional_id))
  WITH CHECK (public.is_org_team_professional(professional_id));
