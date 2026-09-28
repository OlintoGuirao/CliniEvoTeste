-- Salão: membros da mesma org podem ler nome/perfil dos colegas
-- (necessário para faturamento, agenda e lançamentos multi-profissional).

CREATE OR REPLACE FUNCTION public.is_salon_org_colleague(
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
      AND o.type = 'salon'
  );
$$;

REVOKE ALL ON FUNCTION public.is_salon_org_colleague(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_salon_org_colleague(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_salon_org_colleague(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.is_salon_org_colleague IS
  'True se actor e profissional pertencem à mesma organização do tipo salão.';

DROP POLICY IF EXISTS "Salon members can read salon colleague profiles"
  ON public.profiles;

CREATE POLICY "Salon members can read salon colleague profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_salon_org_colleague(id));

COMMENT ON POLICY "Salon members can read salon colleague profiles"
  ON public.profiles IS
  'Membros do salão leem perfil dos colegas (nome no lançamento/faturamento/agenda).';
