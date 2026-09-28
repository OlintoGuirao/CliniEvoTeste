const { supabase } = require('../config/supabase');

async function listFaqItemsForProfessional(professionalId) {
  if (!supabase || !professionalId) return [];

  const { data, error } = await supabase
    .from('whatsapp_bot_faq_items')
    .select('id, question, answer, sort_order')
    .eq('professional_id', professionalId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (/whatsapp_bot_faq_items|relation|column/i.test(error.message || '')) return [];
    throw new Error(error.message);
  }

  return (data || []).map((row, idx) => ({
    id: row.id,
    pickIndex: idx + 1,
    question: String(row.question || '').trim(),
    answer: String(row.answer || '').trim(),
  })).filter((row) => row.question && row.answer);
}

module.exports = {
  listFaqItemsForProfessional,
};
