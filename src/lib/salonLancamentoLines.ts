import { parseAllSalonProceduresFromNotes } from '@/components/salon/SalonProfessionalRibbonLabel';
import {
  salonProcedureIdFromAppointmentNotes,
  salonProcedureIdsFromObservacoes,
  salonProcedureNameFromAppointmentNotes,
} from '@/lib/salonAppointmentNotes';
import {
  fetchSalonAgendaTeamMembers,
  resolveSalonAgendaDisplayLabel,
} from '@/lib/salonAgendaProfessionals';
import { parseSalonValorFromNotes } from '@/lib/salonRecebimentos';
import { formatPersonName } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { fetchSalonProcedures } from '@/services/api/salonProceduresApi';
import type { FormaPagamento } from '@/types/faturamento';

export type SalonLancamentoLine = {
  key: string;
  salonProcedureId: string | null;
  procedureName: string;
  professionalId: string;
  professionalName: string;
  valor: string;
};

function formatValorInput(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  return n.toFixed(2).replace('.', ',');
}

function firstNameOrFull(name: string | null | undefined): string {
  const formatted = formatPersonName(name ?? '') || (name ?? '').trim();
  if (!formatted) return '';
  return formatted;
}

function resolveProfessionalDisplayName(opts: {
  professionalId: string;
  nameByProId: Map<string, string>;
  viewerProfessionalId?: string | null;
  viewerProfessionalName?: string | null;
}): string {
  const fromMap = opts.nameByProId.get(opts.professionalId)?.trim();
  if (fromMap) return fromMap;
  if (
    opts.viewerProfessionalId &&
    opts.professionalId === opts.viewerProfessionalId &&
    opts.viewerProfessionalName?.trim()
  ) {
    return firstNameOrFull(opts.viewerProfessionalName) || opts.viewerProfessionalName.trim();
  }
  return 'Profissional';
}

/**
 * Monta as linhas do lançamento (procedimento + profissional + valor)
 * a partir da sessão, recebimentos e agendamentos do dia.
 */
export async function loadSalonLancamentoLines(params: {
  sessionId?: string | null;
  patientId?: string | null;
  sessionDate: string;
  fallbackProfessionalId: string;
  appointmentNotes?: string | null;
  procedureLabel?: string | null;
  procedureNamesHint?: string[] | null;
  /** Org do salão — permite buscar nomes da equipe (RLS de profiles é restrito). */
  organizationId?: string | null;
  /** Perfil logado (fallback de nome quando o ID é o próprio). */
  viewerProfessionalId?: string | null;
  viewerProfessionalName?: string | null;
}): Promise<{
  lines: SalonLancamentoLine[];
  formaPagamento: FormaPagamento;
  parcelas: number;
}> {
  const sessionDate = params.sessionDate.slice(0, 10);
  let sessionObservacoes: string | null = null;
  let sessionProfessionalId = params.fallbackProfessionalId;

  if (params.sessionId) {
    const { data: session } = await supabase
      .from('patient_sessions')
      .select('observacoes, professional_id')
      .eq('id', params.sessionId)
      .maybeSingle();
    sessionObservacoes = session?.observacoes ?? null;
    if (session?.professional_id) sessionProfessionalId = session.professional_id;
  }

  const notesSource = sessionObservacoes ?? params.appointmentNotes ?? null;
  let names = parseAllSalonProceduresFromNotes(notesSource);
  if (names.length === 0 && params.procedureNamesHint?.length) {
    names = params.procedureNamesHint.filter(Boolean);
  }
  if (names.length === 0 && params.procedureLabel?.trim()) {
    names = [params.procedureLabel.trim()];
  }
  if (names.length === 0) {
    const fromApt = salonProcedureNameFromAppointmentNotes(params.appointmentNotes);
    if (fromApt) names = [fromApt];
  }

  const idsFromNotes = salonProcedureIdsFromObservacoes(notesSource);
  let idsFromNotesOrApt = idsFromNotes;
  if (idsFromNotesOrApt.length === 0) {
    const single = salonProcedureIdFromAppointmentNotes(params.appointmentNotes);
    if (single) idsFromNotesOrApt = [single];
  }

  let procedureIdsAligned: (string | null)[] = names.map((_, i) => idsFromNotesOrApt[i] ?? null);

  const needsCatalog =
    names.some((_, i) => !procedureIdsAligned[i]) ||
    (names.length === 0 && idsFromNotesOrApt.length > 0);

  let catalogById = new Map<string, string>();
  let catalogByName = new Map<string, string>();
  if (needsCatalog) {
    try {
      const catalog = await fetchSalonProcedures();
      catalogById = new Map(catalog.map((p) => [p.id, p.name]));
      catalogByName = new Map(catalog.map((p) => [p.name.trim().toLowerCase(), p.id]));
    } catch {
      // Catálogo indisponível — segue só com o que houver nas notas.
    }
  }

  if (names.some((_, i) => !procedureIdsAligned[i])) {
    procedureIdsAligned = names.map((name, i) => {
      if (procedureIdsAligned[i]) return procedureIdsAligned[i];
      return catalogByName.get(name.trim().toLowerCase()) ?? null;
    });
  }

  if (names.length === 0 && idsFromNotesOrApt.length > 0) {
    procedureIdsAligned = idsFromNotesOrApt;
    names = idsFromNotesOrApt.map((id, i) => catalogById.get(id) ?? `Procedimento ${i + 1}`);
  } else if (names.length === 0 && procedureIdsAligned.some(Boolean)) {
    names = procedureIdsAligned.map(
      (id, i) => (id ? catalogById.get(id) : null) ?? `Procedimento ${i + 1}`
    );
  }

  type RecRow = {
    salon_procedure_id: string | null;
    profissional_id: string;
    valor_total: number | null;
    forma_pagamento: string | null;
    parcelas: number | null;
  };

  let recebimentos: RecRow[] = [];
  if (params.sessionId) {
    const { data } = await supabase
      .from('recebimentos')
      .select('salon_procedure_id, profissional_id, valor_total, forma_pagamento, parcelas')
      .eq('patient_session_id', params.sessionId);
    recebimentos = (data ?? []) as RecRow[];
  }

  const aptProByProcedureId = new Map<string, string>();
  if (params.patientId) {
    const { data: apts } = await supabase
      .from('appointments')
      .select('professional_id, notes')
      .eq('patient_id', params.patientId)
      .eq('appointment_date', sessionDate);
    for (const apt of apts ?? []) {
      if (!apt.professional_id) continue;
      const procId = salonProcedureIdFromAppointmentNotes(apt.notes);
      if (procId) aptProByProcedureId.set(procId, apt.professional_id);
    }
  }

  const recPros = [...new Set(recebimentos.map((r) => r.profissional_id).filter(Boolean))];
  const aptPros = [...new Set([...aptProByProcedureId.values()])];
  const preferAppointmentPros = aptPros.length > 1 && recPros.length <= 1;

  const recByProcedureId = new Map(
    recebimentos
      .filter((r) => r.salon_procedure_id)
      .map((r) => [r.salon_procedure_id as string, r])
  );

  const positiveRecs = recebimentos.filter((r) => Number(r.valor_total) > 0);
  const notesValor = parseSalonValorFromNotes(notesSource);
  let formaPagamento: FormaPagamento = notesValor?.formaPagamento ?? 'pix';
  let parcelas = 1;
  const firstRec = recebimentos[0];
  if (firstRec?.forma_pagamento) {
    const raw = String(firstRec.forma_pagamento).toLowerCase();
    formaPagamento =
      raw === 'cartao' || raw === 'cartão'
        ? 'cartao'
        : raw === 'dinheiro'
          ? 'dinheiro'
          : 'pix';
    if (firstRec.parcelas && firstRec.parcelas > 0) parcelas = firstRec.parcelas;
  }

  const lineCount = Math.max(names.length, procedureIdsAligned.filter(Boolean).length, 1);
  const resolvedNames =
    names.length > 0
      ? names
      : Array.from(
          { length: lineCount },
          (_, i) => params.procedureLabel?.trim() || `Procedimento ${i + 1}`
        );

  const provisionalPros: string[] = [];
  for (let i = 0; i < lineCount; i++) {
    const procId = procedureIdsAligned[i] ?? null;
    const rec = procId ? recByProcedureId.get(procId) : undefined;
    const aptPro = procId ? aptProByProcedureId.get(procId) : undefined;
    let proId = sessionProfessionalId;
    if (preferAppointmentPros && aptPro) proId = aptPro;
    else if (rec?.profissional_id) proId = rec.profissional_id;
    else if (aptPro) proId = aptPro;
    provisionalPros.push(proId);
  }

  const uniqueProIds = [...new Set(provisionalPros.filter(Boolean))];
  const nameByProId = new Map<string, string>();

  // 1) Equipe do salão (organization_members + profiles quando RLS permitir).
  if (params.organizationId) {
    try {
      const team = await fetchSalonAgendaTeamMembers(params.organizationId);
      for (const member of team) {
        const full = firstNameOrFull(member.full_name);
        const label = resolveSalonAgendaDisplayLabel(member);
        const display = full || (label !== '?' ? label : '') || member.agenda_label_nickname?.trim() || '';
        if (display) nameByProId.set(member.user_id, display);
      }
    } catch {
      // Sem acesso à equipe — tenta profiles / viewer abaixo.
    }
  }

  // 2) Profiles (só o próprio costuma passar no RLS do salão).
  if (uniqueProIds.length > 0) {
    const missing = uniqueProIds.filter((id) => !nameByProId.has(id));
    if (missing.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', missing);
      for (const p of profiles ?? []) {
        const display = firstNameOrFull(p.full_name as string | null);
        if (display) nameByProId.set(p.id as string, display);
      }
    }
  }

  // 3) Viewer logado
  if (params.viewerProfessionalId && params.viewerProfessionalName?.trim()) {
    const display =
      firstNameOrFull(params.viewerProfessionalName) || params.viewerProfessionalName.trim();
    if (display && !nameByProId.has(params.viewerProfessionalId)) {
      nameByProId.set(params.viewerProfessionalId, display);
    }
  }

  const lines: SalonLancamentoLine[] = [];
  for (let i = 0; i < lineCount; i++) {
    const procId = procedureIdsAligned[i] ?? null;
    const rec = procId ? recByProcedureId.get(procId) : undefined;
    const proId = provisionalPros[i] || sessionProfessionalId;

    let valor = '';
    if (rec && Number.isFinite(Number(rec.valor_total))) {
      const n = Number(rec.valor_total);
      valor = n > 0 ? formatValorInput(n) : '';
    } else if (positiveRecs.length === 1 && i === 0) {
      valor = formatValorInput(Number(positiveRecs[0].valor_total));
    } else if (i === 0 && notesValor) {
      valor = formatValorInput(notesValor.valorTotal);
    }

    lines.push({
      key: procId ?? `name-${i}-${resolvedNames[i] ?? i}`,
      salonProcedureId: procId,
      procedureName: resolvedNames[i] ?? `Procedimento ${i + 1}`,
      professionalId: proId,
      professionalName: resolveProfessionalDisplayName({
        professionalId: proId,
        nameByProId,
        viewerProfessionalId: params.viewerProfessionalId,
        viewerProfessionalName: params.viewerProfessionalName,
      }),
      valor,
    });
  }

  return { lines, formaPagamento, parcelas };
}
