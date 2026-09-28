import { supabase } from '@/integrations/supabase/client';
import type { FormaPagamento } from '@/types/faturamento';
import { SALON_PROCEDURE_ID_PREFIX } from '@/lib/salonAppointmentNotes';

export type SalonRecebimentoLine = {
  salonProcedureId: string;
  valorTotal: number;
  valorRecebido: number;
};

/** Linha de insert com valor e profissional por procedimento. */
export type SalonRecebimentoInsertLine = {
  salonProcedureId: string;
  professionalId: string;
  valorTotal: number;
};

/** Extrai valor e forma de pagamento de observações de atendimento salão. */
export function parseSalonValorFromNotes(observacoes: string | null | undefined): {
  valorTotal: number;
  formaPagamento: FormaPagamento;
} | null {
  if (!observacoes?.trim()) return null;
  for (const raw of observacoes.split(/\r?\n/)) {
    const line = raw.trim();
    const match = line.match(/^Valor:\s*R\$\s*([\d.,]+)\s*\((\w+)\)/i);
    if (!match) continue;
    let amountStr = match[1].replace(/\./g, '').replace(',', '.');
    const valorTotal = Number(amountStr);
    if (!Number.isFinite(valorTotal) || valorTotal <= 0) continue;
    const formaRaw = match[2].toLowerCase();
    const formaPagamento: FormaPagamento =
      formaRaw === 'cartao' || formaRaw === 'cartão'
        ? 'cartao'
        : formaRaw === 'dinheiro'
          ? 'dinheiro'
          : 'pix';
    return { valorTotal, formaPagamento };
  }
  return null;
}

export function parseSalonProcedureIdsFromNotes(observacoes: string | null | undefined): string[] {
  if (!observacoes?.trim()) return [];
  const ids: string[] = [];
  for (const raw of observacoes.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith(SALON_PROCEDURE_ID_PREFIX)) continue;
    const id = line.slice(SALON_PROCEDURE_ID_PREFIX.length).trim();
    if (/^[0-9a-f-]{36}$/i.test(id)) ids.push(id);
  }
  return ids;
}

/** Grava recebimentos do faturamento para um atendimento salão. */
export async function insertSalonRecebimentosForSession(opts: {
  patientSessionId: string;
  patientId: string;
  professionalId: string;
  sessionDate: string;
  sessionTime?: string | null;
  salonProcedureIds: string[];
  valorTotal: number;
  formaPagamento: FormaPagamento;
  parcelas?: number | null;
  branchId?: string | null;
  /** Quando informado, usa valor e profissional por procedimento (ignora rateio no 1º). */
  lines?: SalonRecebimentoInsertLine[];
}): Promise<{ error: Error | null }> {
  const {
    patientSessionId,
    patientId,
    professionalId,
    sessionDate,
    sessionTime,
    salonProcedureIds,
    valorTotal,
    formaPagamento,
    parcelas,
    branchId,
    lines,
  } = opts;

  const finalLines =
    lines && lines.length > 0
      ? lines
          .filter((l) => l.salonProcedureId)
          .map((l) => ({
            salonProcedureId: l.salonProcedureId,
            professionalId: l.professionalId || professionalId,
            valorTotal: Math.max(0, Number(l.valorTotal) || 0),
          }))
      : salonProcedureIds.map((id, i) => ({
          salonProcedureId: id,
          professionalId,
          valorTotal: i === 0 ? valorTotal : 0,
        }));

  const total = finalLines.reduce((sum, l) => sum + l.valorTotal, 0);
  if (total <= 0 || finalLines.length === 0) {
    return { error: null };
  }

  const dataRecebimento = `${sessionDate}T${(sessionTime?.slice(0, 5) || '00:00')}:00`;

  for (const line of finalLines) {
    const row: Record<string, unknown> = {
      cliente_id: patientId,
      profissional_id: line.professionalId || professionalId,
      salon_procedure_id: line.salonProcedureId,
      patient_session_id: patientSessionId,
      valor_total: line.valorTotal,
      valor_recebido: line.valorTotal,
      forma_pagamento: formaPagamento,
      parcelas: formaPagamento === 'cartao' ? (parcelas ?? 1) : null,
      status: 'pago',
      data: dataRecebimento,
    };
    if (branchId) row.branch_id = branchId;

    const { error } = await supabase.from('recebimentos').insert(row as never);
    if (error) {
      return {
        error: new Error(
          error.message.includes('salon_procedure_id')
            ? 'Faturamento do salão não configurado no banco. Aplique a migration recebimentos_salon_procedure no Supabase.'
            : error.message
        ),
      };
    }
  }

  return { error: null };
}

/** Cria recebimento a partir das observações (backfill de sessões antigas). */
export async function backfillSalonRecebimentoForSession(opts: {
  patientSessionId: string;
  patientId: string;
  professionalId: string;
  sessionDate: string;
  startTime?: string | null;
  observacoes: string | null;
}): Promise<{ created: boolean; error: Error | null }> {
  const { data: existing } = await supabase
    .from('recebimentos')
    .select('id')
    .eq('patient_session_id', opts.patientSessionId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return { created: false, error: null };

  const valor = parseSalonValorFromNotes(opts.observacoes);
  const procedureIds = parseSalonProcedureIdsFromNotes(opts.observacoes);
  if (!valor || procedureIds.length === 0) {
    return { created: false, error: null };
  }

  const { error } = await insertSalonRecebimentosForSession({
    patientSessionId: opts.patientSessionId,
    patientId: opts.patientId,
    professionalId: opts.professionalId,
    sessionDate: opts.sessionDate,
    sessionTime: opts.startTime,
    salonProcedureIds: procedureIds,
    valorTotal: valor.valorTotal,
    formaPagamento: valor.formaPagamento,
    branchId: null,
  });

  return { created: !error, error };
}

/** Recupera recebimentos faltantes dos atendimentos salão do profissional. */
export async function backfillSalonRecebimentosForProfessional(
  professionalId: string
): Promise<number> {
  const { data: sessions, error } = await supabase
    .from('patient_sessions')
    .select('id, patient_id, professional_id, session_date, start_time, observacoes')
    .eq('professional_id', professionalId)
    .ilike('observacoes', '%salon_procedure:%')
    .ilike('observacoes', '%Valor:%');

  if (error || !sessions?.length) return 0;

  let created = 0;
  for (const row of sessions) {
    const result = await backfillSalonRecebimentoForSession({
      patientSessionId: row.id,
      patientId: row.patient_id,
      professionalId: row.professional_id,
      sessionDate: row.session_date,
      startTime: row.start_time,
      observacoes: row.observacoes,
    });
    if (result.created) created += 1;
  }
  return created;
}
