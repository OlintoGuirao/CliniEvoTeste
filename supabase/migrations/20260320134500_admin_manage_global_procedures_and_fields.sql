-- Permite ao admin master gerenciar procedimentos globais e seus campos

CREATE POLICY "Admin can insert global procedures"
  ON public.procedures
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
    AND is_global = true
    AND created_by IS NULL
  );

CREATE POLICY "Admin can update global procedures"
  ON public.procedures
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
    AND is_global = true
    AND created_by IS NULL
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
    AND is_global = true
    AND created_by IS NULL
  );

CREATE POLICY "Admin can manage fields of global procedures"
  ON public.procedure_fields
  FOR ALL
  USING (
    (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
    AND EXISTS (
      SELECT 1
      FROM public.procedures p
      WHERE p.id = procedure_fields.procedure_id
        AND p.is_global = true
        AND p.created_by IS NULL
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'admin@clinievo.com.br'
    AND EXISTS (
      SELECT 1
      FROM public.procedures p
      WHERE p.id = procedure_fields.procedure_id
        AND p.is_global = true
        AND p.created_by IS NULL
    )
  );

