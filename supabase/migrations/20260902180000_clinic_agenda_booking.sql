-- Clínica: membros da mesma org podem agendar na agenda de um colega
-- (recepção marca consulta para o profissional) e listar profissionais da clínica.

CREATE OR REPLACE FUNCTION public.is_clinic_org_colleague(
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
      AND om_pro.user_id = p_professional_id
      AND o.type = 'clinic'
  );
$$;

REVOKE ALL ON FUNCTION public.is_clinic_org_colleague(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_clinic_org_colleague(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinic_org_colleague(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.is_clinic_org_colleague IS
  'True se actor e profissional pertencem à mesma organização do tipo clínica.';

DROP POLICY IF EXISTS "Clinic members manage clinic colleague appointments" ON public.appointments;
CREATE POLICY "Clinic members manage clinic colleague appointments"
  ON public.appointments
  FOR ALL
  TO authenticated
  USING (public.is_clinic_org_colleague(professional_id))
  WITH CHECK (public.is_clinic_org_colleague(professional_id));

DROP POLICY IF EXISTS "Clinic members can read clinic colleague patients" ON public.patients;
CREATE POLICY "Clinic members can read clinic colleague patients"
  ON public.patients
  FOR SELECT
  TO authenticated
  USING (public.is_clinic_org_colleague(professional_id));

CREATE OR REPLACE FUNCTION public.list_clinic_agenda_professionals()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  role public.organization_member_role,
  staff_title text,
  professional_specialty text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    om.user_id,
    p.full_name,
    om.role,
    om.staff_title,
    p.professional_specialty
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  JOIN public.profiles p ON p.id = om.user_id
  WHERE o.type = 'clinic'
    AND om.organization_id IN (SELECT public.get_member_organization_ids(auth.uid()))
    AND om.role <> 'attendant'
    AND COALESCE(p.is_blocked, false) = false
  ORDER BY COALESCE(om.agenda_sort_order, 0), p.full_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.list_clinic_agenda_professionals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_clinic_agenda_professionals() TO authenticated;

COMMENT ON FUNCTION public.list_clinic_agenda_professionals IS
  'Profissionais da clínica (exceto recepção) para o seletor da agenda.';
