-- =============================================================================
-- Copia um paciente (ficha + anamnese + histórico completo) para outro profissional.
-- O registro original NÃO é apagado nem alterado.
--
-- Uso:
--   1) Rode só o bloco "PREVIEW" no SQL Editor do Supabase
--   2) Confira origem/destino e contagens
--   3) Rode o bloco "EXECUTAR" (função + chamada para Olinto / Aline / Juninho)
--
-- Arquivos (fotos, PDFs, exames) reutilizam as mesmas URLs no storage.
-- Links públicos (anamnese, orçamento, relatórios) recebem novos slugs no destino.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PREVIEW — conferir antes de copiar
-- ---------------------------------------------------------------------------
/*
SELECT
  p.id AS patient_id,
  p.full_name,
  p.phone,
  pf_src.full_name AS profissional_origem,
  pf_src.id AS profissional_origem_id
FROM public.patients p
JOIN public.profiles pf_src ON pf_src.id = p.professional_id
WHERE p.full_name ILIKE '%olinto%'
  AND pf_src.full_name ILIKE '%aline%';

SELECT id, full_name, email
FROM public.profiles
WHERE full_name ILIKE '%juninho%';

SELECT
  'procedure_instances' AS tabela, COUNT(*) AS qtd
FROM public.procedure_instances pi
JOIN public.patients p ON p.id = pi.patient_id
JOIN public.profiles pf ON pf.id = p.professional_id
WHERE p.full_name ILIKE '%olinto%' AND pf.full_name ILIKE '%aline%'
UNION ALL
SELECT 'patient_sessions', COUNT(*)
FROM public.patient_sessions ps
JOIN public.patients p ON p.id = ps.patient_id
JOIN public.profiles pf ON pf.id = p.professional_id
WHERE p.full_name ILIKE '%olinto%' AND pf.full_name ILIKE '%aline%'
UNION ALL
SELECT 'appointments', COUNT(*)
FROM public.appointments a
JOIN public.patients p ON p.id = a.patient_id
JOIN public.profiles pf ON pf.id = p.professional_id
WHERE p.full_name ILIKE '%olinto%' AND pf.full_name ILIKE '%aline%'
UNION ALL
SELECT 'programas_botox', COUNT(*)
FROM public.programas_botox pb
JOIN public.patients p ON p.id = pb.paciente_id
JOIN public.profiles pf ON pf.id = p.professional_id
WHERE p.full_name ILIKE '%olinto%' AND pf.full_name ILIKE '%aline%';
*/

-- ---------------------------------------------------------------------------
-- Função reutilizável
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_copy_patient_full(
  p_source_patient_id uuid,
  p_target_professional_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_professional_id uuid;
  v_new_patient_id uuid;
  v_slug text;
  v_i int;
  r record;
  v_new_id uuid;
  v_new_group_id uuid;
  v_counts jsonb := '{}'::jsonb;
  v_n int;
BEGIN
  IF p_source_patient_id IS NULL OR p_target_professional_id IS NULL THEN
    RAISE EXCEPTION 'source_patient_id e target_professional_id são obrigatórios';
  END IF;

  SELECT professional_id
  INTO v_source_professional_id
  FROM public.patients
  WHERE id = p_source_patient_id;

  IF v_source_professional_id IS NULL THEN
    RAISE EXCEPTION 'Paciente origem não encontrado: %', p_source_patient_id;
  END IF;

  IF p_target_professional_id = v_source_professional_id THEN
    RAISE EXCEPTION 'Profissional destino é o mesmo da origem';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_professional_id) THEN
    RAISE EXCEPTION 'Profissional destino não encontrado: %', p_target_professional_id;
  END IF;

  CREATE TEMP TABLE _copy_instance_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE _copy_patient_session_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE _copy_procedure_session_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE _copy_programa_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE _copy_botox_group_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE _copy_budget_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;

  -- 1) Paciente
  INSERT INTO public.patients (
    professional_id,
    full_name,
    date_of_birth,
    sex,
    phone,
    cpf,
    profile_photo_url,
    treatment_start_date,
    general_notes,
    is_active,
    profession,
    address,
    city,
    referred_by,
    consultation_objective,
    emergency_contact_name,
    emergency_contact_phone,
    registration_completed_at,
    whatsapp_birth_date_confirmed_at,
    registration_public_slug,
    created_at,
    updated_at
  )
  SELECT
    p_target_professional_id,
    full_name,
    date_of_birth,
    sex,
    phone,
    cpf,
    profile_photo_url,
    treatment_start_date,
    general_notes,
    is_active,
    profession,
    address,
    city,
    referred_by,
    consultation_objective,
    emergency_contact_name,
    emergency_contact_phone,
    registration_completed_at,
    whatsapp_birth_date_confirmed_at,
    NULL,
    created_at,
    updated_at
  FROM public.patients
  WHERE id = p_source_patient_id
  RETURNING id INTO v_new_patient_id;

  -- 2) LGPD
  INSERT INTO public.lgpd_consents (
    patient_id, consent_given, consent_date, consent_text, ip_address, signature_data, created_at, updated_at
  )
  SELECT
    v_new_patient_id, consent_given, consent_date, consent_text, ip_address, signature_data, created_at, updated_at
  FROM public.lgpd_consents
  WHERE patient_id = p_source_patient_id
  ON CONFLICT (patient_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('lgpd_consents', v_n);

  -- 3) Anamnese
  INSERT INTO public.patient_anamnese (
    patient_id, data, signature_data, signed_at, public_slug, created_at, updated_at
  )
  SELECT
    v_new_patient_id, data, signature_data, signed_at, NULL, created_at, updated_at
  FROM public.patient_anamnese
  WHERE patient_id = p_source_patient_id
  ON CONFLICT (patient_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('patient_anamnese', v_n);

  -- 4) Sessões do paciente
  FOR r IN
    SELECT * FROM public.patient_sessions WHERE patient_id = p_source_patient_id ORDER BY created_at
  LOOP
    v_new_id := gen_random_uuid();
    INSERT INTO public.patient_sessions (
      id, patient_id, professional_id, session_date, observacoes, created_at, updated_at
    ) VALUES (
      v_new_id, v_new_patient_id, p_target_professional_id, r.session_date, r.observacoes, r.created_at, r.updated_at
    );
    INSERT INTO _copy_patient_session_map VALUES (r.id, v_new_id);
  END LOOP;
  SELECT COUNT(*) INTO v_n FROM _copy_patient_session_map;
  v_counts := v_counts || jsonb_build_object('patient_sessions', v_n);

  -- 5) Instâncias de procedimento
  FOR r IN
    SELECT * FROM public.procedure_instances WHERE patient_id = p_source_patient_id ORDER BY created_at
  LOOP
    v_new_id := gen_random_uuid();
    INSERT INTO public.procedure_instances (
      id, procedure_id, patient_id, professional_id, data_inicio, status, observacoes_gerais, created_at, updated_at
    ) VALUES (
      v_new_id, r.procedure_id, v_new_patient_id, p_target_professional_id,
      r.data_inicio, r.status, r.observacoes_gerais, r.created_at, r.updated_at
    );
    INSERT INTO _copy_instance_map VALUES (r.id, v_new_id);
  END LOOP;
  SELECT COUNT(*) INTO v_n FROM _copy_instance_map;
  v_counts := v_counts || jsonb_build_object('procedure_instances', v_n);

  -- 6) Sessões de procedimento
  FOR r IN
    SELECT ps.*
    FROM public.procedure_sessions ps
    JOIN _copy_instance_map m ON m.old_id = ps.procedure_instance_id
    ORDER BY ps.created_at
  LOOP
    v_new_id := gen_random_uuid();
    INSERT INTO public.procedure_sessions (
      id, procedure_instance_id, session_date, data, observacoes, patient_session_id, created_at, updated_at
    ) VALUES (
      v_new_id,
      (SELECT new_id FROM _copy_instance_map WHERE old_id = r.procedure_instance_id),
      r.session_date,
      r.data,
      r.observacoes,
      CASE
        WHEN r.patient_session_id IS NULL THEN NULL
        ELSE (SELECT new_id FROM _copy_patient_session_map WHERE old_id = r.patient_session_id)
      END,
      r.created_at,
      r.updated_at
    );
    INSERT INTO _copy_procedure_session_map VALUES (r.id, v_new_id);
  END LOOP;
  SELECT COUNT(*) INTO v_n FROM _copy_procedure_session_map;
  v_counts := v_counts || jsonb_build_object('procedure_sessions', v_n);

  -- 7) Resultados de procedimento
  INSERT INTO public.procedure_results (
    procedure_instance_id, procedure_session_id, result_data, created_at, updated_at
  )
  SELECT
    m.new_id,
    CASE
      WHEN pr.procedure_session_id IS NULL THEN NULL
      ELSE (SELECT new_id FROM _copy_procedure_session_map WHERE old_id = pr.procedure_session_id)
    END,
    pr.result_data,
    pr.created_at,
    pr.updated_at
  FROM public.procedure_results pr
  JOIN _copy_instance_map m ON m.old_id = pr.procedure_instance_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('procedure_results', v_n);

  -- 8) Fotos de procedimento
  INSERT INTO public.procedure_photos (
    procedure_instance_id, procedure_session_id, photo_type, file_url, created_at
  )
  SELECT
    m.new_id,
    CASE
      WHEN ph.procedure_session_id IS NULL THEN NULL
      ELSE (SELECT new_id FROM _copy_procedure_session_map WHERE old_id = ph.procedure_session_id)
    END,
    ph.photo_type,
    ph.file_url,
    ph.created_at
  FROM public.procedure_photos ph
  JOIN _copy_instance_map m ON m.old_id = ph.procedure_instance_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('procedure_photos', v_n);

  -- 9) Links públicos de relatórios (novos slugs)
  FOR r IN
    SELECT erl.*
    FROM public.emagrecimento_report_links erl
    JOIN _copy_instance_map m ON m.old_id = erl.procedure_instance_id
  LOOP
    v_slug := NULL;
    FOR v_i IN 1..25 LOOP
      v_slug := substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 12);
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.emagrecimento_report_links WHERE lower(trim(slug)) = lower(trim(v_slug))
      );
    END LOOP;
    IF v_slug IS NULL THEN
      RAISE EXCEPTION 'Não foi possível gerar slug para emagrecimento_report_links';
    END IF;
    INSERT INTO public.emagrecimento_report_links (procedure_instance_id, slug)
    VALUES ((SELECT new_id FROM _copy_instance_map WHERE old_id = r.procedure_instance_id), v_slug);
  END LOOP;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('emagrecimento_report_links', v_n);

  FOR r IN
    SELECT prl.*
    FROM public.procedure_report_links prl
    JOIN _copy_instance_map m ON m.old_id = prl.procedure_instance_id
  LOOP
    v_slug := NULL;
    FOR v_i IN 1..25 LOOP
      v_slug := substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 12);
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.procedure_report_links WHERE lower(trim(slug)) = lower(trim(v_slug))
      );
    END LOOP;
    IF v_slug IS NULL THEN
      RAISE EXCEPTION 'Não foi possível gerar slug para procedure_report_links';
    END IF;
    INSERT INTO public.procedure_report_links (procedure_instance_id, slug)
    VALUES ((SELECT new_id FROM _copy_instance_map WHERE old_id = r.procedure_instance_id), v_slug);
  END LOOP;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('procedure_report_links', v_n);

  -- 10) Lembretes de reaplicação Botox
  INSERT INTO public.botox_reapplication_reminders (
    patient_id, procedure_instance_id, procedure_session_id, professional_id,
    due_date, notified_at, created_at, updated_at
  )
  SELECT
    v_new_patient_id,
    CASE
      WHEN br.procedure_instance_id IS NULL THEN NULL
      ELSE (SELECT new_id FROM _copy_instance_map WHERE old_id = br.procedure_instance_id)
    END,
    CASE
      WHEN br.procedure_session_id IS NULL THEN NULL
      ELSE (SELECT new_id FROM _copy_procedure_session_map WHERE old_id = br.procedure_session_id)
    END,
    p_target_professional_id,
    br.due_date,
    br.notified_at,
    br.created_at,
    br.updated_at
  FROM public.botox_reapplication_reminders br
  WHERE br.patient_id = p_source_patient_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('botox_reapplication_reminders', v_n);

  -- 11) Assinaturas de termos
  INSERT INTO public.term_signatures (
    patient_id, patient_session_id, procedure_session_id, term_id, signature_data, signed_at, created_at
  )
  SELECT
    v_new_patient_id,
    CASE
      WHEN ts.patient_session_id IS NULL THEN NULL
      ELSE (SELECT new_id FROM _copy_patient_session_map WHERE old_id = ts.patient_session_id)
    END,
    CASE
      WHEN ts.procedure_session_id IS NULL THEN NULL
      ELSE (SELECT new_id FROM _copy_procedure_session_map WHERE old_id = ts.procedure_session_id)
    END,
    ts.term_id,
    ts.signature_data,
    ts.signed_at,
    ts.created_at
  FROM public.term_signatures ts
  WHERE ts.patient_id = p_source_patient_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('term_signatures', v_n);

  -- 12) Consultas / agenda
  INSERT INTO public.appointments (
    professional_id, patient_id, appointment_date, start_time, notes,
    full_name, pre_registration_phone, is_encaixe, appointment_block_id, is_block_start,
    reminder_24h_sent_at, reminder_1h_sent_at, presence_confirmed_at, presence_declined_at,
    created_at, updated_at
  )
  SELECT
    p_target_professional_id,
    v_new_patient_id,
    a.appointment_date,
    a.start_time,
    a.notes,
    a.full_name,
    a.pre_registration_phone,
    a.is_encaixe,
    a.appointment_block_id,
    a.is_block_start,
    a.reminder_24h_sent_at,
    a.reminder_1h_sent_at,
    a.presence_confirmed_at,
    a.presence_declined_at,
    a.created_at,
    a.updated_at
  FROM public.appointments a
  WHERE a.patient_id = p_source_patient_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('appointments', v_n);

  -- 13) Exames
  INSERT INTO public.patient_exams (
    patient_id, professional_id, exam_name, exam_date, file_url, file_path,
    mime_type, extracted_text, ai_summary, notes, created_at, updated_at
  )
  SELECT
    v_new_patient_id,
    p_target_professional_id,
    pe.exam_name,
    pe.exam_date,
    pe.file_url,
    pe.file_path,
    pe.mime_type,
    pe.extracted_text,
    pe.ai_summary,
    pe.notes,
    pe.created_at,
    pe.updated_at
  FROM public.patient_exams pe
  WHERE pe.patient_id = p_source_patient_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('patient_exams', v_n);

  -- 14) Receituários
  INSERT INTO public.patient_prescriptions (
    patient_id, professional_id, issued_at, prescription_text, pdf_url, pdf_path,
    professional_name_snapshot, patient_name_snapshot, professional_registry_snapshot,
    prescription_title_snapshot, sent_at, created_at, updated_at
  )
  SELECT
    v_new_patient_id,
    p_target_professional_id,
    pp.issued_at,
    pp.prescription_text,
    pp.pdf_url,
    pp.pdf_path,
    pp.professional_name_snapshot,
    pp.patient_name_snapshot,
    pp.professional_registry_snapshot,
    pp.prescription_title_snapshot,
    pp.sent_at,
    pp.created_at,
    pp.updated_at
  FROM public.patient_prescriptions pp
  WHERE pp.patient_id = p_source_patient_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('patient_prescriptions', v_n);

  -- 15) Orçamentos + links públicos
  FOR r IN
    SELECT * FROM public.budget_quotes WHERE patient_id = p_source_patient_id ORDER BY created_at
  LOOP
    v_new_id := gen_random_uuid();
    INSERT INTO public.budget_quotes (
      id, professional_id, patient_id, title, notes, lines, created_at, updated_at
    ) VALUES (
      v_new_id, p_target_professional_id, v_new_patient_id, r.title, r.notes, r.lines, r.created_at, r.updated_at
    );
    INSERT INTO _copy_budget_map VALUES (r.id, v_new_id);
  END LOOP;

  FOR r IN
    SELECT bql.*
    FROM public.budget_quote_public_links bql
    JOIN _copy_budget_map m ON m.old_id = bql.budget_quote_id
  LOOP
    v_slug := NULL;
    FOR v_i IN 1..25 LOOP
      v_slug := substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 12);
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.budget_quote_public_links WHERE lower(trim(slug)) = lower(trim(v_slug))
      );
    END LOOP;
    IF v_slug IS NULL THEN
      RAISE EXCEPTION 'Não foi possível gerar slug para budget_quote_public_links';
    END IF;
    INSERT INTO public.budget_quote_public_links (budget_quote_id, slug)
    VALUES ((SELECT new_id FROM _copy_budget_map WHERE old_id = r.budget_quote_id), v_slug);
  END LOOP;
  SELECT COUNT(*) INTO v_n FROM _copy_budget_map;
  v_counts := v_counts || jsonb_build_object('budget_quotes', v_n);

  -- 16) Faturamento / recebimentos
  INSERT INTO public.recebimentos (
    cliente_id, profissional_id, procedimento_id, valor_total, valor_recebido,
    forma_pagamento, status, data, created_at
  )
  SELECT
    v_new_patient_id,
    p_target_professional_id,
    rec.procedimento_id,
    rec.valor_total,
    rec.valor_recebido,
    rec.forma_pagamento,
    rec.status,
    rec.data,
    rec.created_at
  FROM public.recebimentos rec
  WHERE rec.cliente_id = p_source_patient_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('recebimentos', v_n);

  -- 17) Programa de Botox (grupos + programas + pagamentos + sessões + cobranças)
  FOR r IN
    SELECT pb.*
    FROM public.programas_botox pb
    WHERE pb.paciente_id = p_source_patient_id
    ORDER BY pb.created_at
  LOOP
    IF NOT EXISTS (SELECT 1 FROM _copy_botox_group_map WHERE old_id = r.group_id) THEN
      INSERT INTO public.botox_groups (professional_id, name, period_start, period_end, created_at, updated_at)
      SELECT
        p_target_professional_id,
        coalesce(bg.name, 'Grupo importado'),
        bg.period_start,
        bg.period_end,
        bg.created_at,
        bg.updated_at
      FROM public.botox_groups bg
      WHERE bg.id = r.group_id
      RETURNING id INTO v_new_group_id;
      INSERT INTO _copy_botox_group_map VALUES (r.group_id, v_new_group_id);
    END IF;

    v_new_id := gen_random_uuid();
    INSERT INTO public.programas_botox (
      id, professional_id, paciente_id, data_inicio, status, total_sessoes, sessoes_realizadas,
      dia_vencimento, valor_mensalidade, group_id, created_at, updated_at
    ) VALUES (
      v_new_id,
      p_target_professional_id,
      v_new_patient_id,
      r.data_inicio,
      r.status,
      r.total_sessoes,
      r.sessoes_realizadas,
      r.dia_vencimento,
      r.valor_mensalidade,
      (SELECT new_id FROM _copy_botox_group_map WHERE old_id = r.group_id),
      r.created_at,
      r.updated_at
    );
    INSERT INTO _copy_programa_map VALUES (r.id, v_new_id);
  END LOOP;

  INSERT INTO public.pagamentos (programa_id, valor, mes_referencia, data_pagamento, created_at)
  SELECT
    pm.new_id,
    pg.valor,
    pg.mes_referencia,
    pg.data_pagamento,
    pg.created_at
  FROM public.pagamentos pg
  JOIN _copy_programa_map pm ON pm.old_id = pg.programa_id;

  INSERT INTO public.sessoes (programa_id, data, mes_referencia, created_at)
  SELECT
    pm.new_id,
    s.data,
    s.mes_referencia,
    s.created_at
  FROM public.sessoes s
  JOIN _copy_programa_map pm ON pm.old_id = s.programa_id;

  INSERT INTO public.programa_botox_cobrancas (programa_id, mes_referencia, channel, provider_message_id, sent_at)
  SELECT
    pm.new_id,
    pbc.mes_referencia,
    pbc.channel,
    pbc.provider_message_id,
    pbc.sent_at
  FROM public.programa_botox_cobrancas pbc
  JOIN _copy_programa_map pm ON pm.old_id = pbc.programa_id;

  SELECT COUNT(*) INTO v_n FROM _copy_programa_map;
  v_counts := v_counts || jsonb_build_object('programas_botox', v_n);

  -- 18) Histórico de aniversário WhatsApp (opcional, só registro)
  IF to_regclass('public.patient_birthday_whatsapp_sent') IS NOT NULL THEN
    INSERT INTO public.patient_birthday_whatsapp_sent (
      patient_id, professional_id, birth_year, channel, provider_message_id, sent_at
    )
    SELECT
      v_new_patient_id,
      p_target_professional_id,
      pbs.birth_year,
      pbs.channel,
      pbs.provider_message_id,
      pbs.sent_at
    FROM public.patient_birthday_whatsapp_sent pbs
    WHERE pbs.patient_id = p_source_patient_id
    ON CONFLICT (patient_id, birth_year) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('patient_birthday_whatsapp_sent', v_n);
  END IF;

  RETURN jsonb_build_object(
    'source_patient_id', p_source_patient_id,
    'source_professional_id', v_source_professional_id,
    'target_professional_id', p_target_professional_id,
    'new_patient_id', v_new_patient_id,
    'copied', v_counts
  );
END;
$$;

COMMENT ON FUNCTION public.admin_copy_patient_full(uuid, uuid) IS
  'Copia paciente completo para outro profissional (uso admin / SQL Editor). Original permanece intacto.';

REVOKE ALL ON FUNCTION public.admin_copy_patient_full(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_copy_patient_full(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- EXECUTAR — Olinto (Aline → Juninho)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_source_patient_id uuid;
  v_source_prof_id uuid;
  v_target_prof_id uuid;
  v_result jsonb;
BEGIN
  SELECT id INTO v_source_prof_id
  FROM public.profiles
  WHERE full_name ILIKE '%aline%'
  ORDER BY created_at
  LIMIT 1;

  IF v_source_prof_id IS NULL THEN
    RAISE EXCEPTION 'Profissional origem "Aline" não encontrado';
  END IF;

  SELECT id INTO v_target_prof_id
  FROM public.profiles
  WHERE full_name ILIKE '%juninho%'
  ORDER BY created_at
  LIMIT 1;

  IF v_target_prof_id IS NULL THEN
    RAISE EXCEPTION 'Profissional destino "Juninho" não encontrado';
  END IF;

  SELECT p.id
  INTO v_source_patient_id
  FROM public.patients p
  WHERE p.professional_id = v_source_prof_id
    AND p.full_name ILIKE '%olinto%'
  ORDER BY p.created_at
  LIMIT 1;

  IF v_source_patient_id IS NULL THEN
    RAISE EXCEPTION 'Paciente "Olinto" não encontrado na carteira da Aline';
  END IF;

  SELECT public.admin_copy_patient_full(v_source_patient_id, v_target_prof_id)
  INTO v_result;

  RAISE NOTICE 'Cópia concluída: %', v_result;
END;
$$;

-- Conferir resultado
SELECT
  p.id,
  p.full_name,
  p.phone,
  pf.full_name AS profissional,
  p.created_at
FROM public.patients p
JOIN public.profiles pf ON pf.id = p.professional_id
WHERE p.full_name ILIKE '%olinto%'
ORDER BY pf.full_name, p.created_at;
