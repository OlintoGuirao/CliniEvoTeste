import { supabase } from '@/integrations/supabase/client';
import type { FormaPagamento } from '@/types/faturamento';
import {
  SALON_PROCEDURE_ID_PREFIX,
  SALON_RECURRING_SCHEDULE_PREFIX,
  salonProcedureIdFromAppointmentNotes,
  salonProcedureIdsFromObservacoes,
} from '@/lib/salonAppointmentNotes';
import {
  insertSalonRecebimentosForSession,
  parseSalonValorFromNotes,
  type SalonRecebimentoInsertLine,
} from '@/lib/salonRecebimentos';

function parseMoneyInput(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '').trim();
  if (!s) return 0;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function parseSalonValorDisplayLine(valorLine: string | null | undefined): {
  valor: string;
  formaPagamento: FormaPagamento;
} | null {
  if (!valorLine?.trim()) return null;
  const match = valorLine.trim().match(/^R\$\s*([\d.,]+)\s*\((\w+)\)/i);
  if (!match) return null;
  const formaRaw = match[2].toLowerCase();
  const formaPagamento: FormaPagamento =
    formaRaw === 'cartao' || formaRaw === 'cartão'
      ? 'cartao'
      : formaRaw === 'dinheiro'
        ? 'dinheiro'
        : 'pix';
  return { valor: match[1], formaPagamento };
}

function buildValorLine(valorTotal: number, formaPagamento: FormaPagamento): string {
  return `Valor: R$ ${valorTotal.toFixed(2).replace('.', ',')} (${formaPagamento})`;
}

function upsertValorLineInObservacoes(
  observacoes: string | null | undefined,
  valorTotal: number,
  formaPagamento: FormaPagamento
): string {
  const lines = String(observacoes ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((line) => line && !/^Valor:/i.test(line));
  if (valorTotal > 0) lines.push(buildValorLine(valorTotal, formaPagamento));
  return lines.join('\n');
}

function observacoesFromAppointmentNotes(
  notes: string | null | undefined,
  procedureLabel: string | null | undefined
): string {
  const lines: string[] = [];
  let hasProcLine = false;
  let hasProcId = false;

  for (const raw of String(notes ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^Procedimento:/i.test(line)) {
      lines.push(line);
      hasProcLine = true;
      continue;
    }
    if (line.startsWith(SALON_PROCEDURE_ID_PREFIX)) {
      lines.push(line);
      hasProcId = true;
      continue;
    }
    if (line.startsWith(SALON_RECURRING_SCHEDULE_PREFIX)) {
      lines.push(line);
    }
  }

  if (!hasProcLine && procedureLabel?.trim()) {
    lines.unshift(`Procedimento: ${procedureLabel.trim()}`);
  }
  const procId = salonProcedureIdFromAppointmentNotes(notes);
  if (!hasProcId && procId) {
    lines.push(`${SALON_PROCEDURE_ID_PREFIX}${procId}`);
  }

  return lines.join('\n');
}

async function syncSalonRecebimentos(opts: {
  patientSessionId: string;
  patientId: string;
  professionalId: string;
  sessionDate: string;
  sessionTime?: string | null;
  observacoes: string | null;
  salonProcedureIds: string[];
  valorTotal: number;
  formaPagamento: FormaPagamento;
  parcelas?: number | null;
  branchId?: string | null;
  lines?: SalonRecebimentoInsertLine[];
}): Promise<{ error: Error | null }> {
  await supabase.from('recebimentos').delete().eq('patient_session_id', opts.patientSessionId);

  if (opts.valorTotal <= 0 || opts.salonProcedureIds.length === 0) {
    return { error: null };
  }

  return insertSalonRecebimentosForSession({
    patientSessionId: opts.patientSessionId,
    patientId: opts.patientId,
    professionalId: opts.professionalId,
    sessionDate: opts.sessionDate,
    sessionTime: opts.sessionTime,
    salonProcedureIds: opts.salonProcedureIds,
    valorTotal: opts.valorTotal,
    formaPagamento: opts.formaPagamento,
    parcelas: opts.parcelas,
    branchId: opts.branchId,
    lines: opts.lines,
  });
}

export type SalonCompletionProcedureLine = {
  salonProcedureId: string;
  professionalId: string;
  valorInput: string;
};

export async function saveSalonAppointmentCompletion(opts: {
  appointmentId?: string | null;
  sessionId?: string | null;
  patientId: string;
  professionalId: string;
  sessionDate: string;
  sessionTime?: string | null;
  appointmentNotes?: string | null;
  procedureLabel?: string | null;
  isAlreadyCompleted: boolean;
  markCompleted: boolean;
  valorInput: string;
  formaPagamento: FormaPagamento;
  parcelas?: number | null;
  branchId?: string | null;
  /** Quando informado, grava valor e profissional por procedimento. */
  procedureLines?: SalonCompletionProcedureLine[];
}): Promise<{ error: Error | null }> {
  const procedureLines = (opts.procedureLines ?? [])
    .filter((l) => l.salonProcedureId)
    .map((l) => ({
      salonProcedureId: l.salonProcedureId,
      professionalId: l.professionalId || opts.professionalId,
      valorTotal: parseMoneyInput(l.valorInput),
    }));

  const valorTotal =
    procedureLines.length > 0
      ? procedureLines.reduce((sum, l) => sum + l.valorTotal, 0)
      : parseMoneyInput(opts.valorInput);

  if (!opts.markCompleted) {
    return { error: new Error('Somente atendimentos concluídos podem ser registrados aqui.') };
  }

  if (!opts.patientId) {
    return { error: new Error('Cliente não vinculado ao agendamento.') };
  }

  const startTime =
    opts.sessionTime && opts.sessionTime.length >= 5 ? `${opts.sessionTime.slice(0, 5)}:00` : null;

  if (opts.isAlreadyCompleted && opts.sessionId) {
    const { data: existing, error: fetchErr } = await supabase
      .from('patient_sessions')
      .select('id, observacoes')
      .eq('id', opts.sessionId)
      .maybeSingle();
    if (fetchErr) return { error: new Error(fetchErr.message) };
    if (!existing?.id) return { error: new Error('Sessão do atendimento não encontrada.') };

    const observacoes = upsertValorLineInObservacoes(
      existing.observacoes,
      valorTotal,
      opts.formaPagamento
    );
    const { error: updateErr } = await supabase
      .from('patient_sessions')
      .update({ observacoes: observacoes || null })
      .eq('id', existing.id);
    if (updateErr) return { error: new Error(updateErr.message) };

    const procedureIds =
      procedureLines.length > 0
        ? procedureLines.map((l) => l.salonProcedureId)
        : salonProcedureIdsFromObservacoes(observacoes);
    return syncSalonRecebimentos({
      patientSessionId: existing.id,
      patientId: opts.patientId,
      professionalId: opts.professionalId,
      sessionDate: opts.sessionDate,
      sessionTime: opts.sessionTime,
      observacoes,
      salonProcedureIds: procedureIds,
      valorTotal,
      formaPagamento: opts.formaPagamento,
      parcelas: opts.parcelas,
      branchId: opts.branchId,
      lines: procedureLines.length > 0 ? procedureLines : undefined,
    });
  }

  let observacoesBase = observacoesFromAppointmentNotes(opts.appointmentNotes, opts.procedureLabel);
  if (!observacoesBase.trim()) {
    observacoesBase = observacoesFromAppointmentNotes(null, opts.procedureLabel);
  }
  const observacoes = upsertValorLineInObservacoes(observacoesBase, valorTotal, opts.formaPagamento);
  const procedureIds =
    procedureLines.length > 0
      ? procedureLines.map((l) => l.salonProcedureId)
      : salonProcedureIdsFromObservacoes(observacoes);

  if (valorTotal > 0 && procedureIds.length === 0) {
    return {
      error: new Error(
        'Procedimento do salão não identificado no agendamento. Conclua pelo fluxo de atendimento ou vincule o procedimento na agenda.'
      ),
    };
  }

  const { data: psRow, error: psError } = await supabase
    .from('patient_sessions')
    .insert({
      patient_id: opts.patientId,
      professional_id: opts.professionalId,
      session_date: opts.sessionDate,
      start_time: startTime,
      observacoes: observacoes || null,
    })
    .select('id')
    .single();
  if (psError) return { error: new Error(psError.message) };

  if (psRow?.id && valorTotal > 0 && procedureIds.length > 0) {
    const { error: recError } = await syncSalonRecebimentos({
      patientSessionId: psRow.id,
      patientId: opts.patientId,
      professionalId: opts.professionalId,
      sessionDate: opts.sessionDate,
      sessionTime: opts.sessionTime,
      observacoes,
      salonProcedureIds: procedureIds,
      valorTotal,
      formaPagamento: opts.formaPagamento,
      parcelas: opts.parcelas,
      branchId: opts.branchId,
      lines: procedureLines.length > 0 ? procedureLines : undefined,
    });
    if (recError) return { error: recError };
  }

  // Mantém o agendamento na agenda para o master do salão ver o histórico do dia (concluído via sessão).
  return { error: null };
}

/** Pré-preenche valor/forma a partir da sessão ou do texto exibido no card. */
export function initialSalonCompletionBilling(opts: {
  valorLine?: string | null;
  sessionObservacoes?: string | null;
}): { valor: string; formaPagamento: FormaPagamento; parcelas: number } {
  const fromDisplay = parseSalonValorDisplayLine(opts.valorLine);
  if (fromDisplay) {
    return { valor: fromDisplay.valor, formaPagamento: fromDisplay.formaPagamento, parcelas: 1 };
  }
  const parsed = parseSalonValorFromNotes(opts.sessionObservacoes);
  if (parsed) {
    return {
      valor: parsed.valorTotal.toFixed(2).replace('.', ','),
      formaPagamento: parsed.formaPagamento,
      parcelas: 1,
    };
  }
  return { valor: '', formaPagamento: 'pix', parcelas: 1 };
}

/** Garante patient_id para concluir atendimento (cria cliente rápido se necessário). */
export async function resolveSalonAppointmentPatientId(opts: {
  appointmentId: string;
  fallbackProfessionalId: string;
}): Promise<string | null> {
  const { data: apt, error } = await supabase
    .from('appointments')
    .select('patient_id, full_name, pre_registration_phone, professional_id')
    .eq('id', opts.appointmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!apt) return null;
  if (apt.patient_id) return apt.patient_id;

  const fullName = apt.full_name?.trim();
  if (!fullName) return null;

  const profId = apt.professional_id ?? opts.fallbackProfessionalId;
  const { data: created, error: createErr } = await supabase
    .from('patients')
    .insert({
      professional_id: profId,
      full_name: fullName,
      phone: apt.pre_registration_phone?.trim() || null,
      registration_completed_at: null,
    })
    .select('id')
    .single();
  if (createErr) throw new Error(createErr.message);
  if (!created?.id) return null;

  const { error: linkErr } = await supabase
    .from('appointments')
    .update({ patient_id: created.id })
    .eq('id', opts.appointmentId);
  if (linkErr) throw new Error(linkErr.message);

  return created.id;
}
