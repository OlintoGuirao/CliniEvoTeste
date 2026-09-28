import { supabase } from '@/integrations/supabase/client';

export type WhatsappBotFaqItem = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
};

export async function fetchWhatsappBotFaqItems(professionalId: string): Promise<WhatsappBotFaqItem[]> {
  const { data, error } = await (supabase as any)
    .from('whatsapp_bot_faq_items')
    .select('id, question, answer, sort_order')
    .eq('professional_id', professionalId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as WhatsappBotFaqItem[];
}

export async function replaceWhatsappBotFaqItems(
  professionalId: string,
  items: Array<{ question: string; answer: string }>
): Promise<void> {
  const { error: deleteError } = await (supabase as any)
    .from('whatsapp_bot_faq_items')
    .delete()
    .eq('professional_id', professionalId);

  if (deleteError) throw new Error(deleteError.message);

  const rows = items
    .map((item, index) => ({
      professional_id: professionalId,
      question: item.question.trim(),
      answer: item.answer.trim(),
      sort_order: index,
      updated_at: new Date().toISOString(),
    }))
    .filter((row) => row.question && row.answer);

  if (!rows.length) return;

  const { error: insertError } = await (supabase as any).from('whatsapp_bot_faq_items').insert(rows);
  if (insertError) throw new Error(insertError.message);
}
