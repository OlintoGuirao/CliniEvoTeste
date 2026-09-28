import { normalizeSearchText } from '@/lib/brazilianCities';

/** Origem que abre o campo opcional "Indicado por". */
export function isIndicationOriginName(name: string | null | undefined): boolean {
  const normalized = normalizeSearchText(name ?? '').trim();
  if (!normalized) return false;
  return normalized === 'indicacao' || normalized.startsWith('indicacao');
}
