import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneDigits } from '@/lib/phone';

export type AgendaSelectablePatient = {
  id: string;
  full_name: string;
  nickname?: string | null;
  phone: string | null;
  is_active?: boolean;
  registration_completed_at?: string | null;
};

/**
 * Mantém apenas pacientes ativos com cadastro completo
 * ou com interação real de WhatsApp (conversa vinculada).
 */
export async function filterAgendaSelectablePatients<T extends AgendaSelectablePatient>(
  rows: T[]
): Promise<T[]> {
  const active = rows.filter((p) => p.is_active !== false);
  if (active.length === 0) return [];

  const completed = active.filter((p) => p.registration_completed_at != null);
  const incomplete = active.filter((p) => p.registration_completed_at == null);
  if (incomplete.length === 0) return completed;

  const incompleteIds = incomplete.map((p) => p.id);
  const phoneSet = new Set(
    incomplete
      .map((p) => normalizePhoneDigits(p.phone))
      .filter((digits): digits is string => Boolean(digits && digits.length >= 8))
  );

  const interactedIds = new Set<string>();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: byPatient } = await db
      .from('whatsapp_conversations')
      .select('patient_id')
      .in('patient_id', incompleteIds)
      .not('patient_id', 'is', null);
    for (const row of (byPatient ?? []) as Array<{ patient_id?: string | null }>) {
      if (row.patient_id) interactedIds.add(String(row.patient_id));
    }
  } catch {
    // tabela pode não existir em ambientes antigos
  }

  if (phoneSet.size > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data: byPhone } = await db
        .from('whatsapp_conversations')
        .select('patient_id, patient_phone')
        .not('patient_phone', 'is', null)
        .limit(500);
      for (const row of (byPhone ?? []) as Array<{
        patient_id?: string | null;
        patient_phone?: string | null;
      }>) {
        const digits = normalizePhoneDigits(row.patient_phone);
        if (!digits || !phoneSet.has(digits)) continue;
        const match = incomplete.find((p) => normalizePhoneDigits(p.phone) === digits);
        if (match) interactedIds.add(match.id);
        if (row.patient_id) interactedIds.add(String(row.patient_id));
      }
    } catch {
      // ignora
    }
  }

  return active.filter(
    (p) => p.registration_completed_at != null || interactedIds.has(p.id)
  );
}
