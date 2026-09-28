export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function searchBrazilianCities(
  cities: readonly string[],
  query: string,
  limit = 10
): string[] {
  const q = normalizeSearchText(query.trim());
  if (q.length < 2 || cities.length === 0) return [];

  const startsWith: string[] = [];
  const contains: string[] = [];

  for (const city of cities) {
    const normalized = normalizeSearchText(city);
    if (normalized.startsWith(q)) startsWith.push(city);
    else if (normalized.includes(q)) contains.push(city);
  }

  return [...startsWith, ...contains].slice(0, limit);
}

let citiesCache: string[] | null = null;
let citiesPromise: Promise<string[]> | null = null;

export function loadBrazilianCities(): Promise<string[]> {
  if (citiesCache) return Promise.resolve(citiesCache);
  if (!citiesPromise) {
    citiesPromise = import('@/data/brazilian-cities.json').then((mod) => {
      const list = (mod.default ?? mod) as string[];
      citiesCache = list;
      return list;
    });
  }
  return citiesPromise;
}
