import { normalizeSearchText } from '@/lib/brazilianCities';

export function filterSalonProceduresByQuery<T extends { name: string }>(
  procedures: readonly T[],
  query: string,
  limit = 30
): T[] {
  const q = normalizeSearchText(query.trim());
  if (!q) return procedures.slice(0, limit) as T[];

  const startsWith: T[] = [];
  const contains: T[] = [];
  for (const proc of procedures) {
    const normalized = normalizeSearchText(proc.name);
    if (normalized.startsWith(q)) startsWith.push(proc);
    else if (normalized.includes(q)) contains.push(proc);
  }
  return [...startsWith, ...contains].slice(0, limit);
}
