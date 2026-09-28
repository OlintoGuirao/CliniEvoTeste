import { supabase } from '@/integrations/supabase/client';

/**
 * Normaliza um telefone para apenas dígitos, removendo o código do país
 * brasileiro (55) e máscaras. Mantém DDD + número (até 11 dígitos).
 */
export function normalizePhoneDigits(phone: string | null | undefined): string {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.length > 11) {
    digits = digits.slice(-11);
  }
  return digits;
}

/**
 * Aplica a máscara visual (DD) 99999-9999 para exibição. Usa apenas dígitos.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return '';
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length <= 2) return `(${ddd}`;
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (digits.length <= 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
}

export interface PatientPhoneMatch {
  id: string;
  full_name: string;
  phone: string | null;
  is_active?: boolean | null;
  registration_completed_at?: string | null;
}

function normalizePersonName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica no banco se já existe paciente do mesmo profissional com este telefone
 * (ignorando "55", máscaras e espaços). Permite excluir um ID específico (útil
 * em telas de edição). Retorna o melhor candidato (cadastro completo + ativo).
 */
export async function findExistingPatientByPhone(opts: {
  professionalId: string;
  phone: string | null | undefined;
  excludePatientId?: string | null;
}): Promise<PatientPhoneMatch | null> {
  const target = normalizePhoneDigits(opts.phone);
  if (!target || !opts.professionalId) return null;

  const core = target.slice(2);
  const ddd = target.slice(0, 2);
  const filters: string[] = [];
  if (core.length >= 6) filters.push(`phone.ilike.%${core}%`);
  if (target.length >= 10) filters.push(`phone.ilike.%${ddd}%${target.slice(-8)}%`);
  if (target.length >= 8) filters.push(`phone.ilike.%${target.slice(-8)}%`);
  if (filters.length === 0) return null;

  try {
    const { data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone, is_active, registration_completed_at')
      .eq('professional_id', opts.professionalId)
      .or(filters.join(','))
      .limit(50);
    if (error) throw error;
    const rows = (data ?? []) as PatientPhoneMatch[];
    const matches = rows.filter((p) => {
      if (opts.excludePatientId && p.id === opts.excludePatientId) return false;
      const norm = normalizePhoneDigits(p.phone);
      if (norm === target) return true;
      if (target.length >= 9 && norm.length >= 9 && norm.slice(-9) === target.slice(-9)) return true;
      if (target.length >= 8 && norm.length >= 8 && norm.slice(-8) === target.slice(-8)) return true;
      return false;
    });
    if (matches.length === 0) return null;
    matches.sort((a, b) => {
      const aComplete = a.registration_completed_at ? 1 : 0;
      const bComplete = b.registration_completed_at ? 1 : 0;
      if (aComplete !== bComplete) return bComplete - aComplete;
      const aActive = a.is_active !== false ? 1 : 0;
      const bActive = b.is_active !== false ? 1 : 0;
      return bActive - aActive;
    });
    return matches[0];
  } catch (err) {
    console.warn('[findExistingPatientByPhone] busca falhou', err);
    return null;
  }
}

/**
 * Busca paciente pelo telefone e nome (útil no salão, onde o mesmo telefone
 * pode ser compartilhado entre familiares).
 */
export async function findPatientByPhoneAndName(opts: {
  professionalId: string;
  phone: string | null | undefined;
  fullName: string;
  excludePatientId?: string | null;
}): Promise<PatientPhoneMatch | null> {
  const target = normalizePhoneDigits(opts.phone);
  const targetName = normalizePersonName(opts.fullName);
  if (!target || !targetName || !opts.professionalId) return null;

  const core = target.slice(2);
  const ddd = target.slice(0, 2);
  const filters: string[] = [];
  if (core.length >= 6) filters.push(`phone.ilike.%${core}%`);
  if (target.length >= 10) filters.push(`phone.ilike.%${ddd}%${target.slice(-8)}%`);
  if (target.length >= 8) filters.push(`phone.ilike.%${target.slice(-8)}%`);
  if (filters.length === 0) return null;

  try {
    const { data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone, is_active, registration_completed_at')
      .eq('professional_id', opts.professionalId)
      .or(filters.join(','))
      .limit(50);
    if (error) throw error;
    const rows = (data ?? []) as PatientPhoneMatch[];
    const matches = rows.filter((p) => {
      if (opts.excludePatientId && p.id === opts.excludePatientId) return false;
      if (normalizePersonName(p.full_name) !== targetName) return false;
      const norm = normalizePhoneDigits(p.phone);
      if (norm === target) return true;
      if (target.length >= 9 && norm.length >= 9 && norm.slice(-9) === target.slice(-9)) return true;
      if (target.length >= 8 && norm.length >= 8 && norm.slice(-8) === target.slice(-8)) return true;
      return false;
    });
    if (matches.length === 0) return null;
    matches.sort((a, b) => {
      const aComplete = a.registration_completed_at ? 1 : 0;
      const bComplete = b.registration_completed_at ? 1 : 0;
      if (aComplete !== bComplete) return bComplete - aComplete;
      const aActive = a.is_active !== false ? 1 : 0;
      const bActive = b.is_active !== false ? 1 : 0;
      return bActive - aActive;
    });
    return matches[0];
  } catch (err) {
    console.warn('[findPatientByPhoneAndName] busca falhou', err);
    return null;
  }
}
