-- Garante que programas_botox só usem grupos do mesmo profissional
-- (evita cobrança/lista cruzada após cópia de pacientes)

CREATE OR REPLACE FUNCTION public.enforce_programa_botox_group_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_group_professional_id uuid;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT professional_id
  INTO v_group_professional_id
  FROM public.botox_groups
  WHERE id = NEW.group_id;

  IF v_group_professional_id IS NULL THEN
    RAISE EXCEPTION 'Grupo de Botox % não encontrado', NEW.group_id;
  END IF;

  IF v_group_professional_id IS DISTINCT FROM NEW.professional_id THEN
    RAISE EXCEPTION
      'O grupo do Programa de Botox deve pertencer ao mesmo profissional do programa (group=% programa=%)',
      v_group_professional_id,
      NEW.professional_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_programa_botox_group_owner ON public.programas_botox;
CREATE TRIGGER trg_programa_botox_group_owner
  BEFORE INSERT OR UPDATE OF group_id, professional_id
  ON public.programas_botox
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_programa_botox_group_owner();

-- Corrige vínculos órfãos já existentes: finaliza programas cujo grupo é de outro profissional
UPDATE public.programas_botox pb
SET
  status = 'finalizado',
  updated_at = now()
FROM public.botox_groups bg
WHERE pb.group_id = bg.id
  AND pb.professional_id IS DISTINCT FROM bg.professional_id
  AND pb.status = 'ativo';
