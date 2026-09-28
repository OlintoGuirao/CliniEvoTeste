import { supabase } from '@/integrations/supabase/client';
import { normalizeIgnoredPhoneList } from '@/lib/whatsappIgnoredPhones';

export async function fetchBranchWhatsappIgnoredPhones(branchId: string): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from('branch_whatsapp_settings')
    .select('whatsapp_ignored_phones')
    .eq('branch_id', branchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return [];
  return normalizeIgnoredPhoneList(data.whatsapp_ignored_phones);
}

export async function updateBranchWhatsappIgnoredPhones(
  branchId: string,
  phones: string[]
): Promise<void> {
  const normalized = normalizeIgnoredPhoneList(phones);

  const { data: existing, error: readErr } = await (supabase as any)
    .from('branch_whatsapp_settings')
    .select('branch_id')
    .eq('branch_id', branchId)
    .maybeSingle();

  if (readErr) throw new Error(readErr.message);

  if (existing) {
    const { error } = await (supabase as any)
      .from('branch_whatsapp_settings')
      .update({ whatsapp_ignored_phones: normalized })
      .eq('branch_id', branchId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await (supabase as any).from('branch_whatsapp_settings').insert({
    branch_id: branchId,
    whatsapp_ignored_phones: normalized,
  });
  if (error) throw new Error(error.message);
}
