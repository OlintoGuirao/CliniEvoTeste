/**
 * Procedimentos do catálogo odontológico (seed/planilha) — exclusivos de conta clínica.
 * Não devem aparecer em profissional único (solo) nem salão.
 */
export function isClinicDentalCatalogProcedure(p: {
  category?: string | null;
  specialty?: string | null;
  slug?: string | null;
}): boolean {
  const category = (p.category ?? '').trim().toLowerCase();
  const specialty = (p.specialty ?? '').trim().toLowerCase();
  const slug = (p.slug ?? '').trim().toLowerCase();

  if (category.includes('odont')) return true;
  if (specialty === 'odontologico') return true;
  if (slug.startsWith('odontologia-')) return true;
  return false;
}
