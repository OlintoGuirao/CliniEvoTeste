import { normalizePhoneDigits } from '@/lib/phone';

/** Normaliza para comparação/armazenamento (DDI 55 quando aplicável). */
export function canonicalWhatsappIgnoredPhone(input: string | null | undefined): string | null {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12) return digits;
  return null;
}

export function normalizeIgnoredPhoneList(phones: string[] | null | undefined): string[] {
  const out = new Set<string>();
  for (const raw of phones ?? []) {
    const canonical = canonicalWhatsappIgnoredPhone(raw);
    if (canonical) out.add(canonical);
  }
  return Array.from(out);
}

export function phonesMatchIgnored(a: string, b: string): boolean {
  const va = new Set<string>();
  const vb = new Set<string>();
  for (const v of [canonicalWhatsappIgnoredPhone(a), normalizePhoneDigits(a)].filter(Boolean)) {
    va.add(v as string);
    const d = v as string;
    if (d.startsWith('55') && d.length >= 12) va.add(d.slice(2));
    if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) va.add(`55${d}`);
  }
  for (const v of [canonicalWhatsappIgnoredPhone(b), normalizePhoneDigits(b)].filter(Boolean)) {
    vb.add(v as string);
    const d = v as string;
    if (d.startsWith('55') && d.length >= 12) vb.add(d.slice(2));
    if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) vb.add(`55${d}`);
  }
  for (const x of va) {
    if (vb.has(x)) return true;
  }
  return false;
}
