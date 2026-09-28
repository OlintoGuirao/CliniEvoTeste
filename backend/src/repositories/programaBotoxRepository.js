const { supabase } = require('../config/supabase');
const {
  buildMonthRange,
  monthKeyFromIsoDate,
  getBrazilBillingContext,
} = require('../lib/botoxBillingMessage');

const DEFAULT_VALOR_MENSALIDADE = 150;

async function findProgramaById(programaId) {
  if (!supabase || !programaId) return null;

  const { data, error } = await supabase
    .from('programas_botox')
    .select(
      'id, professional_id, paciente_id, dia_vencimento, status, data_inicio, group_id, valor_mensalidade, patients:paciente_id(full_name, phone), botox_groups:group_id(id, period_start, period_end, professional_id)'
    )
    .eq('id', programaId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function totalPagoNoMes(programaId, mesReferencia) {
  if (!supabase || !programaId) return 0;

  const { data, error } = await supabase
    .from('pagamentos')
    .select('valor')
    .eq('programa_id', programaId)
    .eq('mes_referencia', mesReferencia);

  if (error) throw new Error(error.message);
  return (data || []).reduce((sum, row) => sum + Number(row.valor || 0), 0);
}

async function fetchPagamentosByPrograma(programaId) {
  if (!supabase || !programaId) return [];

  const { data, error } = await supabase
    .from('pagamentos')
    .select('id, programa_id, valor, mes_referencia, data_pagamento')
    .eq('programa_id', programaId)
    .order('data_pagamento', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

async function resolveValorMensalidade(programa) {
  const fromColumn = Number(programa?.valor_mensalidade);
  if (Number.isFinite(fromColumn) && fromColumn > 0) return fromColumn;

  const pays = await fetchPagamentosByPrograma(programa.id);
  const last = pays.find((p) => Number(p.valor) > 0);
  if (last) return Number(last.valor);

  return DEFAULT_VALOR_MENSALIDADE;
}

/**
 * Meses cobráveis via WhatsApp: do início do programa/grupo até o mês vigente
 * (nunca além do mês atual nem além do fim do grupo).
 * Grupos encerrados ainda entram se houver meses não pagos no período.
 */
async function getPendingMonths(programa) {
  const { mesReferencia: currentMes } = getBrazilBillingContext();
  const startFromPrograma = monthKeyFromIsoDate(programa.data_inicio);
  const startFromGroup = monthKeyFromIsoDate(programa.botox_groups?.period_start);
  const endFromGroup = monthKeyFromIsoDate(programa.botox_groups?.period_end);

  // Grupo de outro profissional → não cobrar (vazamento pós-cópia)
  if (
    programa.botox_groups?.professional_id &&
    programa.professional_id &&
    programa.botox_groups.professional_id !== programa.professional_id
  ) {
    return [];
  }

  let startKey = startFromPrograma || startFromGroup || currentMes;
  if (startFromGroup && startKey < startFromGroup) startKey = startFromGroup;

  // Corta no mês vigente e no fim do grupo (ex.: grupo até 2026-03 → só até mar)
  let endKey = currentMes;
  if (endFromGroup && endKey > endFromGroup) endKey = endFromGroup;
  if (endKey < startKey) return [];

  const range = buildMonthRange(startKey, endKey);
  const pending = [];
  for (const mesKey of range) {
    const pago = await totalPagoNoMes(programa.id, mesKey);
    if (pago <= 0) pending.push(mesKey);
  }
  return pending;
}

async function alreadySentCobranca(programaId, mesReferencia) {
  if (!supabase || !programaId) return false;

  const { data, error } = await supabase
    .from('programa_botox_cobrancas')
    .select('id')
    .eq('programa_id', programaId)
    .eq('mes_referencia', mesReferencia)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function recordCobranca({ programaId, mesReferencia, channel, providerMessageId }) {
  if (!supabase || !programaId) return;

  const { error } = await supabase.from('programa_botox_cobrancas').upsert(
    {
      programa_id: programaId,
      mes_referencia: mesReferencia,
      channel: channel || 'evolution',
      provider_message_id: providerMessageId || null,
      sent_at: new Date().toISOString(),
    },
    { onConflict: 'programa_id,mes_referencia' }
  );

  if (error) throw new Error(error.message);
}

async function recordCobrancaForMonths({ programaId, monthKeys, channel, providerMessageId }) {
  for (const mesReferencia of monthKeys || []) {
    await recordCobranca({ programaId, mesReferencia, channel, providerMessageId });
  }
}

async function isAutoSendEnabled(professionalId) {
  if (!supabase || !professionalId) return false;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('auto_send_programa_botox_billing')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.auto_send_programa_botox_billing === true;
}

async function findActiveProgramasDueToday(dayOfMonth) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('programas_botox')
    .select(
      'id, professional_id, paciente_id, dia_vencimento, status, data_inicio, group_id, valor_mensalidade, patients:paciente_id(full_name, phone), botox_groups:group_id(id, period_start, period_end, professional_id)'
    )
    .eq('status', 'ativo')
    .eq('dia_vencimento', dayOfMonth);

  if (error) throw new Error(error.message);
  return (data || []).filter(
    (p) =>
      !p.botox_groups?.professional_id || p.botox_groups.professional_id === p.professional_id
  );
}

async function findActiveProgramasByProfessional(professionalId) {
  if (!supabase || !professionalId) return [];

  const { data, error } = await supabase
    .from('programas_botox')
    .select(
      'id, professional_id, paciente_id, dia_vencimento, status, data_inicio, group_id, valor_mensalidade, patients:paciente_id(full_name, phone), botox_groups:group_id(id, period_start, period_end, professional_id)'
    )
    .eq('status', 'ativo')
    .eq('professional_id', professionalId);

  if (error) throw new Error(error.message);
  return (data || []).filter(
    (p) =>
      !p.botox_groups?.professional_id || p.botox_groups.professional_id === professionalId
  );
}

module.exports = {
  findProgramaById,
  totalPagoNoMes,
  resolveValorMensalidade,
  getPendingMonths,
  alreadySentCobranca,
  recordCobranca,
  recordCobrancaForMonths,
  isAutoSendEnabled,
  findActiveProgramasDueToday,
  findActiveProgramasByProfessional,
  DEFAULT_VALOR_MENSALIDADE,
};
