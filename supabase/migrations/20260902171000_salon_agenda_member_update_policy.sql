-- Permite ao owner da org atualizar apelido/ordem/cor da agenda nos membros.
-- Necessário para fallback de save via cliente quando a RPC não confirma.

DROP POLICY IF EXISTS "Org owners can update member agenda prefs" ON public.organization_members;
CREATE POLICY "Org owners can update member agenda prefs"
  ON public.organization_members
  FOR UPDATE
  TO authenticated
  USING (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
  )
  WITH CHECK (
    public.is_clinic_owner(auth.uid())
    AND organization_id IN (SELECT public.get_owned_organization_ids(auth.uid()))
  );
