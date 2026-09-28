const { supabase } = require('../config/supabase');
const { getBrazilBillingContext } = require('../lib/budgetQuoteBillingMessage');

async function findQuoteById(quoteId) {
  if (!supabase || !quoteId) return null;

  const { data, error } = await supabase
    .from('budget_quotes')
    .select(
      'id, professional_id, patient_id, title, status, patient_payment_day, patients:patient_id(full_name, phone)'
    )
    .eq('id', quoteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/** Parcelas não pagas com mes_referencia <= mês vigente. */
async function getPendingPayments(quoteId) {
  if (!supabase || !quoteId) return [];

  const { mesReferencia: currentMes } = getBrazilBillingContext();
  const { data, error } = await supabase
    .from('budget_quote_payments')
    .select('id, budget_quote_id, mes_referencia, valor, data_pagamento')
    .eq('budget_quote_id', quoteId)
    .is('data_pagamento', null)
    .lte('mes_referencia', currentMes)
    .order('mes_referencia', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

async function alreadySentCobranca(quoteId, mesReferencia) {
  if (!supabase || !quoteId) return false;

  const { data, error } = await supabase
    .from('budget_quote_cobrancas')
    .select('id')
    .eq('budget_quote_id', quoteId)
    .eq('mes_referencia', mesReferencia)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function recordCobrancaForMonths({ quoteId, monthKeys, channel, providerMessageId }) {
  if (!supabase || !quoteId) return;
  for (const mesReferencia of monthKeys || []) {
    const { error } = await supabase.from('budget_quote_cobrancas').upsert(
      {
        budget_quote_id: quoteId,
        mes_referencia: mesReferencia,
        channel: channel || 'evolution_pix',
        provider_message_id: providerMessageId || null,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'budget_quote_id,mes_referencia' }
    );
    if (error) throw new Error(error.message);
  }
}

async function isAutoSendEnabled(professionalId) {
  if (!supabase || !professionalId) return false;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('auto_send_budget_quote_billing')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.auto_send_budget_quote_billing === true;
}

async function findAcceptedQuotesDueToday(dayOfMonth) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('budget_quotes')
    .select(
      'id, professional_id, patient_id, title, status, patient_payment_day, patients:patient_id(full_name, phone)'
    )
    .eq('status', 'accepted')
    .eq('patient_payment_day', dayOfMonth);

  if (error) throw new Error(error.message);
  return data || [];
}

async function findAcceptedQuotesByProfessional(professionalId) {
  if (!supabase || !professionalId) return [];

  const { data, error } = await supabase
    .from('budget_quotes')
    .select(
      'id, professional_id, patient_id, title, status, patient_payment_day, patients:patient_id(full_name, phone)'
    )
    .eq('status', 'accepted')
    .eq('professional_id', professionalId)
    .order('responded_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

module.exports = {
  findQuoteById,
  getPendingPayments,
  alreadySentCobranca,
  recordCobrancaForMonths,
  isAutoSendEnabled,
  findAcceptedQuotesDueToday,
  findAcceptedQuotesByProfessional,
};
