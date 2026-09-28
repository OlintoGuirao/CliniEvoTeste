-- Apagar grupo de Botox com programas vinculados (bypass RLS controlado por auth.uid)

ALTER TABLE public.programas_botox
  DROP CONSTRAINT IF EXISTS programas_botox_group_id_fkey;

ALTER TABLE public.programas_botox
  ADD CONSTRAINT programas_botox_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.botox_groups(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.delete_botox_group_by_id(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_professional_id uuid;
BEGIN
  IF p_group_id IS NULL THEN
    RAISE EXCEPTION 'group_id é obrigatório';
  END IF;

  SELECT professional_id
  INTO v_professional_id
  FROM public.botox_groups
  WHERE id = p_group_id;

  IF v_professional_id IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  IF v_professional_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão para apagar este grupo';
  END IF;

  DELETE FROM public.programas_botox
  WHERE group_id = p_group_id
    AND professional_id = v_professional_id;

  DELETE FROM public.botox_groups
  WHERE id = p_group_id
    AND professional_id = v_professional_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_botox_group_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_botox_group_by_id(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_botox_group_by_id(uuid) IS
  'Remove grupo do programa de Botox e todos os programas/pagamentos/sessões vinculados do profissional autenticado.';
