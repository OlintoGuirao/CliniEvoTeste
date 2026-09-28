-- Catálogo odontológico global (ODONTOLOGIA / odontologia-*):
-- SELECT só para conta clínica e admin master.
-- Solo e salão não leem mais essas linhas via PostgREST (antes: is_global = true liberava tudo).

CREATE OR REPLACE FUNCTION public.is_clinic_dental_catalog_procedure(
  p_category text,
  p_specialty text,
  p_slug text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    lower(coalesce(p_category, '')) LIKE '%odont%'
    OR lower(coalesce(p_specialty, '')) = 'odontologico'
    OR coalesce(p_slug, '') LIKE 'odontologia-%';
$$;

COMMENT ON FUNCTION public.is_clinic_dental_catalog_procedure(text, text, text) IS
  'Identifica procedimentos do catálogo odontológico exclusivo de clínica.';

DROP POLICY IF EXISTS "Users can view global procedures and their own custom procedures"
  ON public.procedures;

CREATE POLICY "Users can view global procedures and their own custom procedures"
  ON public.procedures
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR (
      is_global = true
      AND (
        NOT public.is_clinic_dental_catalog_procedure(category, specialty, slug)
        OR EXISTS (
          SELECT 1
          FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND (
              pr.account_type = 'clinic'
              OR lower(coalesce(pr.email, '')) = 'admin@clinievo.com.br'
            )
        )
      )
    )
  );

-- Mantém a RPC alinhada (já existia em 20260909150000; reforça specialty odontológico).
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
          NOT public.is_clinic_dental_catalog_procedure(p.category, p.specialty, p.slug)
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
  'Lista procedimentos visíveis ao perfil; catálogo odontológico só para account_type clinic.';
