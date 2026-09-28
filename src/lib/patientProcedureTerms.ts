/** Procedimento que exige o termo de toxina botulínica na ficha do paciente. */
export const PROCEDURE_SLUG_BOTOX = 'botox' as const;

/**
 * Procedimentos que exigem o termo de preenchedores na ficha do paciente.
 * Lista alinhada aos procedimentos injetáveis/estéticos do catálogo global.
 */
export const PROCEDURE_SLUGS_TERM_PREENCHEDORES = [
  'harmonizacao-glutea',
  'lipo-enzimatica-gordura-localizada',
  'lipoenzimatica',
  'enzimas',
  'bioestimulador-colageno',
  'fios-pdo',
  'fios-aptos',
  'lipo-papada-enzimatica',
  'microagulhamento',
  'peeling',
  'preenchimento-facial',
  'skinbooster',
  'peim',
  'terapia-capilar',
  'endolaser',
  'ultrassom-microfocado',
  'ultrassom-macrofocado',
  'i-lipo',
  'ozonio',
  'depilacao-definitiva-feminina',
  'depilacao-definitiva-masculina',
] as const;

export type ProcedureSlugTermPreenchedores = (typeof PROCEDURE_SLUGS_TERM_PREENCHEDORES)[number];

const PREENCHEDORES_SLUG_SET = new Set<string>(PROCEDURE_SLUGS_TERM_PREENCHEDORES);

export function collectPatientProcedureSlugs(
  instances: Array<{ procedures?: { slug?: string | null } | null }>
): Set<string> {
  const slugs = new Set<string>();
  for (const instance of instances) {
    const slug = instance.procedures?.slug?.trim();
    if (slug) slugs.add(slug);
  }
  return slugs;
}

export function patientHasTermBotoxTab(slugs: Iterable<string>): boolean {
  for (const slug of slugs) {
    if (slug === PROCEDURE_SLUG_BOTOX) return true;
  }
  return false;
}

export function patientHasTermPreenchedoresTab(slugs: Iterable<string>): boolean {
  for (const slug of slugs) {
    if (PREENCHEDORES_SLUG_SET.has(slug)) return true;
  }
  return false;
}
