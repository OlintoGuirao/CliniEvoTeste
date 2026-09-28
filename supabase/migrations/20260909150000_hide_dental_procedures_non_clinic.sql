-- Procedimentos odontológicos (category ODONTOLOGIA / slug odontologia-*)
-- só entram em get_procedures_for_profile para account_type = clinic.

CREATE OR REPLACE FUNCTION public.get_procedures_for_profile(p_profile_id UUID)
RETURNS SETOF public.procedures
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.*
    FROM public.procedures p
    WHERE p.is_active = true
      AND (p.is_global = true OR p.created_by = p_profile_id)
      AND (
          NOT EXISTS (
              SELECT 1 FROM public.profile_procedure_permissions perm
              WHERE perm.profile_id = p_profile_id
          )
          OR
          EXISTS (
              SELECT 1 FROM public.profile_procedure_permissions perm
              WHERE perm.profile_id = p_profile_id
                AND perm.procedure_id = p.id
                AND perm.visible = true
          )
      )
      AND (
          -- Catálogo odontológico: só clínica (e profissionais da clínica)
          NOT (
            lower(coalesce(p.category, '')) LIKE '%odont%'
            OR lower(coalesce(p.specialty, '')) = 'odontologico'
            OR coalesce(p.slug, '') LIKE 'odontologia-%'
          )
          OR EXISTS (
            SELECT 1
            FROM public.profiles pr
            WHERE pr.id = p_profile_id
              AND pr.account_type = 'clinic'
          )
      )
    ORDER BY p.category, p.name;
$$;

COMMENT ON FUNCTION public.get_procedures_for_profile(UUID) IS
  'Lista procedimentos visíveis ao perfil; procedimentos odontológicos só para account_type clinic.';
