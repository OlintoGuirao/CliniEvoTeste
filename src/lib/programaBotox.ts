import { supabase } from '@/integrations/supabase/client';

export type ProgramaBotoxStatus = 'ativo' | 'finalizado';

export interface BotoxGroupRow {
  id: string;
  professional_id: string;
  name: string | null;
  period_start: string; // date
  period_end: string; // date
  created_at: string;
  updated_at: string;
}

export interface ProgramaBotoxRow {
  id: string;
  professional_id: string;
  paciente_id: string;
  group_id: string;
  data_inicio: string; // date
  status: ProgramaBotoxStatus;
  total_sessoes: number;
  sessoes_realizadas: number;
  dia_vencimento?: number | null; // dia do mês preferido para pagamento (1-31)
  valor_mensalidade?: number | null;
  created_at: string;
  updated_at: string;
  patients?: { id: string; full_name: string; phone: string | null } | null;
  botox_groups?: Pick<BotoxGroupRow, 'id' | 'name' | 'period_start' | 'period_end' | 'professional_id'> | null;
}

export interface PagamentoRow {
  id: string;
  programa_id: string;
  valor: number;
  mes_referencia: string;
  data_pagamento: string;
}

export interface SessaoRow {
  id: string;
  programa_id: string;
  data: string;
  mes_referencia: string;
}

export function monthKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Extrai YYYY-MM de uma data ISO (YYYY-MM-DD) sem deslocar fuso. */
export function monthKeyFromIso(iso: string): string {
  const raw = String(iso || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);
  const d = new Date(iso);
  return monthKeyFromDate(d);
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-');
  const month = Number(m);
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[Math.max(0, Math.min(11, month - 1))]} ${y}`;
}

/** Compacto para planilha mobile: Mai/25 */
export function formatMonthLabelCompact(key: string): string {
  const [y, m] = key.split('-');
  const month = Number(m);
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const yy = String(y).slice(-2);
  return `${names[Math.max(0, Math.min(11, month - 1))]}/${yy}`;
}

export function buildMonthRange(startKey: string, endKey: string): string[] {
  const [sy, sm] = startKey.split('-').map(Number);
  const [ey, em] = endKey.split('-').map(Number);
  const out: string[] = [];
  const d = new Date(sy, sm - 1, 1);
  const end = new Date(ey, em - 1, 1);
  while (d <= end) {
    out.push(monthKeyFromDate(d));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/** Retorna o primeiro dia do mês para um mesKey (ex: "2026-03" -> Date 1º Mar 2026). */
export function firstDayOfMonthKey(mesKey: string): Date {
  const [y, m] = mesKey.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

export async function fetchProgramasBotox(professionalId: string) {
  const { data, error } = await supabase
    .from('programas_botox')
    .select(
      'id, professional_id, paciente_id, group_id, data_inicio, status, total_sessoes, sessoes_realizadas, dia_vencimento, valor_mensalidade, created_at, updated_at, patients(id, full_name, phone), botox_groups(id, name, period_start, period_end, professional_id)'
    )
    .eq('professional_id', professionalId)
    .order('data_inicio', { ascending: true });
  if (error) throw error;
  // Só programas cujo grupo pertence a este profissional (evita vazamento pós-cópia)
  return ((data ?? []) as ProgramaBotoxRow[]).filter(
    (p) => !p.botox_groups?.professional_id || p.botox_groups.professional_id === professionalId
  );
}

export async function fetchBotoxGroups(professionalId: string) {
  const { data, error } = await (supabase as unknown as { from: (t: string) => any })
    .from('botox_groups')
    .select('id, professional_id, name, period_start, period_end, created_at, updated_at')
    .eq('professional_id', professionalId)
    .order('period_start', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BotoxGroupRow[];
}

export async function fetchPagamentos(programaIds: string[]) {
  if (programaIds.length === 0) return [] as PagamentoRow[];
  const { data, error } = await supabase
    .from('pagamentos')
    .select('id, programa_id, valor, mes_referencia, data_pagamento')
    .in('programa_id', programaIds)
    .order('data_pagamento', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PagamentoRow[];
}

export async function fetchSessoes(programaIds: string[]) {
  if (programaIds.length === 0) return [] as SessaoRow[];
  const { data, error } = await supabase
    .from('sessoes')
    .select('id, programa_id, data, mes_referencia')
    .in('programa_id', programaIds)
    .order('data', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SessaoRow[];
}

export async function inserirPagamento(params: { programaId: string; valor: number; mesReferencia: string; dataPagamento?: Date }) {
  const payload = {
    programa_id: params.programaId,
    valor: params.valor,
    mes_referencia: params.mesReferencia,
    data_pagamento: (params.dataPagamento ?? new Date()).toISOString(),
  };
  const { data, error } = await supabase
    .from('pagamentos')
    .insert(payload)
    .select('id, programa_id, valor, mes_referencia, data_pagamento')
    .single();
  if (error) throw error;
  return data as PagamentoRow;
}

export async function inserirSessao(params: { programaId: string; mesReferencia: string; data?: Date }) {
  const payload = {
    programa_id: params.programaId,
    mes_referencia: params.mesReferencia,
    data: (params.data ?? new Date()).toISOString(),
  };
  const { data, error } = await supabase.from('sessoes').insert(payload).select('id, programa_id, data, mes_referencia').single();
  if (error) throw error;
  return data as SessaoRow;
}

export function totalPago(pagamentos: PagamentoRow[], programaId: string): number {
  return pagamentos
    .filter((p) => p.programa_id === programaId)
    .reduce((acc, p) => acc + Number(p.valor || 0), 0);
}

export function totalPagoNoMes(pagamentos: PagamentoRow[], programaId: string, mesKey: string): number {
  return pagamentos
    .filter((p) => p.programa_id === programaId && p.mes_referencia === mesKey)
    .reduce((acc, p) => acc + Number(p.valor || 0), 0);
}

/** Total esperado do período (meses × mensalidade), pago acumulado e restante. */
export function resumoFinanceiroPrograma(params: {
  pagamentos: PagamentoRow[];
  programaId: string;
  monthCount: number;
  valorMensalidade?: number | null;
}): { pago: number; restante: number; totalEsperado: number } {
  const mensalidade = Number(params.valorMensalidade ?? 0);
  const totalEsperado = Math.max(0, params.monthCount) * (Number.isFinite(mensalidade) ? mensalidade : 0);
  const pago = totalPago(params.pagamentos, params.programaId);
  const restante = Math.max(0, totalEsperado - pago);
  return { pago, restante, totalEsperado };
}

/**
 * Cada mês em `monthKeysOrdered` entre o início do programa e antes de `mesKey` tem pagamento (> 0).
 * `programaMesInicioKey` = "YYYY-MM" derivado de `data_inicio` (meses anteriores à entrada ignorados).
 */
export function mesesAnterioresTodosPagos(
  monthKeysOrdered: string[],
  mesKey: string,
  pagamentos: PagamentoRow[],
  programaId: string,
  programaMesInicioKey?: string | null
): boolean {
  const idx = monthKeysOrdered.indexOf(mesKey);
  if (idx <= 0) return true;
  let fromIdx = 0;
  if (programaMesInicioKey) {
    const j = monthKeysOrdered.indexOf(programaMesInicioKey);
    if (j >= 0) fromIdx = j;
  }
  for (let i = fromIdx; i < idx; i++) {
    if (totalPagoNoMes(pagamentos, programaId, monthKeysOrdered[i]!) <= 0) return false;
  }
  return true;
}

export function sessoesNoMes(sessoes: SessaoRow[], programaId: string, mesKey: string): number {
  return sessoes.filter((s) => s.programa_id === programaId && s.mes_referencia === mesKey).length;
}

/** Sessões do programa naquele mês, ordenadas por data/hora. */
export function sessoesListaNoMes(sessoes: SessaoRow[], programaId: string, mesKey: string): SessaoRow[] {
  return sessoes
    .filter((s) => s.programa_id === programaId && s.mes_referencia === mesKey)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
}

/** Agendamentos na agenda vinculados ao programa (via coluna notes). */
export type ProgramaBotoxAgendaAppointmentRow = {
  id: string;
  patient_id: string | null;
  appointment_date: string;
  start_time: string;
  notes: string | null;
};

export const PROGRAMA_BOTOX_AGENDA_PREFIX = 'programa_botox:';

/** Linha em `appointments.notes` ao agendar pela Agenda com ?procedureSlug= (ex.: botox). */
const PROCEDURE_CONTEXT_PREFIX = 'procedure_context:';

/** Deriva o slug do procedimento para abrir só esse fluxo na consulta (ex.: botox). */
export function procedureSlugFromAppointmentNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const lines = String(notes).split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith(PROGRAMA_BOTOX_AGENDA_PREFIX)) return 'botox';
    if (line.startsWith(PROCEDURE_CONTEXT_PREFIX)) {
      const slug = line.slice(PROCEDURE_CONTEXT_PREFIX.length).trim();
      if (slug) return slug;
    }
  }
  return null;
}

/** Anexa marca de contexto sem duplicar. */
export function appendProcedureContextToNotes(existingNotes: string | null | undefined, slug: string): string {
  const tag = `${PROCEDURE_CONTEXT_PREFIX}${slug.trim()}`;
  const base = String(existingNotes ?? '').trim();
  if (!base) return tag;
  if (base.split(/\r?\n/).some((l) => l.trim() === tag)) return base;
  return `${base}\n${tag}`;
}

export function programaBotoxAgendaNote(programaId: string): string {
  return `${PROGRAMA_BOTOX_AGENDA_PREFIX}${programaId}`;
}

export function parseProgramaIdFromBotoxAgendaNote(notes: string | null | undefined): string | null {
  if (!notes || !notes.startsWith(PROGRAMA_BOTOX_AGENDA_PREFIX)) return null;
  const id = notes.slice(PROGRAMA_BOTOX_AGENDA_PREFIX.length).trim();
  return id || null;
}

/** Agendamentos do programa cujo mês ainda não tem sessão (consomem 1 do saldo até registrar sessão). */
export function agendamentosPendentesProgramaBotox(
  appts: ProgramaBotoxAgendaAppointmentRow[],
  sessoes: SessaoRow[],
  programaId: string
): ProgramaBotoxAgendaAppointmentRow[] {
  return appts.filter((a) => {
    const pid = parseProgramaIdFromBotoxAgendaNote(a.notes);
    if (pid !== programaId) return false;
    const mesKey = monthKeyFromIso(a.appointment_date);
    return sessoesNoMes(sessoes, programaId, mesKey) === 0;
  });
}

export function agendamentosPendentesNoMes(
  appts: ProgramaBotoxAgendaAppointmentRow[],
  sessoes: SessaoRow[],
  programaId: string,
  mesKey: string
): ProgramaBotoxAgendaAppointmentRow[] {
  return agendamentosPendentesProgramaBotox(appts, sessoes, programaId).filter(
    (a) => monthKeyFromIso(a.appointment_date) === mesKey
  );
}

export function countAgendamentosPendentesProgramaBotox(
  appts: ProgramaBotoxAgendaAppointmentRow[],
  sessoes: SessaoRow[],
  programaId: string
): number {
  return agendamentosPendentesProgramaBotox(appts, sessoes, programaId).length;
}

export function saldoSessoesRestantes(
  totalSessoes: number,
  sessoesRealizadas: number,
  pendentesAgenda: number
): number {
  return Math.max(0, totalSessoes - sessoesRealizadas - pendentesAgenda);
}

