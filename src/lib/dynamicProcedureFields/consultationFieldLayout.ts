import type { Database } from '@/integrations/supabase/types';

export type ProcedureFieldRow = Database['public']['Tables']['procedure_fields']['Row'];

export const PEIM_LABEL_OVERRIDES: Record<string, string> = {
  regiao_tratada: 'Região tratada',
  quantidade_microvasos: 'Qtd. microvasos (estimativa)',
  classificacao_vasos: 'Classificação dos vasos',
  cor_vasos: 'Cor dos vasos',
  volume_total_ml: 'Volume total (ml)',
  quantidade_aplicacoes: 'Qtd. aplicações',
  uso_anestesia: 'Uso de anestesia',
  tempo_procedimento_min: 'Tempo do procedimento (min)',
};

export const PEIM_OPTIONS_OVERRIDES: Record<string, string[]> = {
  classificacao_vasos: ['Telangiectasia', 'Reticular', 'Outros'],
  cor_vasos: ['Vermelho', 'Roxo', 'Azul'],
  tecnica_utilizada: ['Injeção direta', 'Espuma', 'Mista'],
  substancia_utilizada: ['Glicose 50%', 'Glicose 75%', 'Outra'],
  contraindicacoes: ['Gestação', 'Lactação', 'Trombose', 'Alergia', 'Diabetes descompensada', 'Outros'],
};

export const TERAPIA_CAPILAR_TECHNIQUE_MICROAGULHAMENTO = 'Microagulhamento';
export const TERAPIA_CAPILAR_SCALP_MAP_IMAGE = '/scalp-map.png';
export const TERAPIA_CAPILAR_SCALP_MAP_VIEWBOX = { width: 950, height: 611 } as const;

export function shouldShowTerapiaCapilarScalpMap(slug: string, data: Record<string, unknown>): boolean {
  return slug === 'terapia-capilar' && data.tecnica_utilizada === TERAPIA_CAPILAR_TECHNIQUE_MICROAGULHAMENTO;
}

export function resolveApplicationMapProps(
  slug: string,
  sessionData?: Record<string, unknown>
): {
  imageSrc?: string;
  caption?: string;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
} {
  if (slug === 'harmonizacao-glutea') {
    return {
      imageSrc: '/gluteal-map.png',
      caption: 'Mapa glúteo — clique para marcar pontos de aplicação',
    };
  }
  if (sessionData && shouldShowTerapiaCapilarScalpMap(slug, sessionData)) {
    return {
      imageSrc: TERAPIA_CAPILAR_SCALP_MAP_IMAGE,
      caption: 'Mapa capilar — clique para marcar pontos de aplicação',
      viewBoxWidth: TERAPIA_CAPILAR_SCALP_MAP_VIEWBOX.width,
      viewBoxHeight: TERAPIA_CAPILAR_SCALP_MAP_VIEWBOX.height,
    };
  }
  return {};
}

export function shouldShowApplicationMapInSession(
  slug: string,
  sessionData: Record<string, unknown>,
  pointsCount: number,
  strokesCount: number
): boolean {
  const hasMapData = pointsCount > 0 || strokesCount > 0;
  if (!hasMapData) return false;
  if (slug === 'botox' || slug === 'preenchimento-facial') return true;
  if (PROCEDURE_SLUGS_WITH_FACIAL_MAP.includes(slug as (typeof PROCEDURE_SLUGS_WITH_FACIAL_MAP)[number])) {
    return true;
  }
  return shouldShowTerapiaCapilarScalpMap(slug, sessionData);
}

export const PROCEDURE_SLUGS_WITH_FACIAL_MAP = [
  'bioestimulador-colageno',
  'endolaser',
  'fios-pdo',
  'harmonizacao-glutea',
  'microagulhamento',
  'preenchimento-facial',
  'skinbooster',
  'ultrassom-microfocado',
] as const;

function normalizeComparisonFieldText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isLegacyBeforeAfterImageField(field: ProcedureFieldRow): boolean {
  if (field.field_type !== 'image') return false;
  const label = normalizeComparisonFieldText(field.label);
  const key = normalizeComparisonFieldText(field.field_key).replace(/[-\s]/g, '_');
  return (
    label.includes('foto antes') ||
    label.includes('foto depois') ||
    key.includes('foto_antes') ||
    key.includes('foto_depois') ||
    key.includes('before') ||
    key.includes('after') ||
    key.includes('antes') ||
    key.includes('depois')
  );
}

const FULL_WIDTH_FIELD_LABELS = [
  'Foto Antes da Sessão',
  'Região tratada',
  'Foto Depois da Sessão',
  'Observações',
  'Queixa principal',
  'Objetivo do tratamento',
  'Diagnóstico capilar',
] as const;

const PEIM_FULL_WIDTH_FIELD_KEYS = [
  'queixa_principal',
  'regiao_tratada',
  'uso_medicamentos',
  'contraindicacoes',
  'equipamentos_utilizados',
] as const;

const TERAPIA_CAPILAR_FULL_WIDTH_FIELD_KEYS = [
  'queixa_principal',
  'objetivo_tratamento',
  'diagnostico_capilar',
  'doencas',
  'uso_medicamentos',
  'alergias',
  'evolucao_observada',
  'resposta_tratamento',
  'intercorrencias',
  'orientacoes_paciente',
  'observacoes',
] as const;

const TERAPIA_CAPILAR_COUPO_CABELO_BOOLEAN_KEYS = [
  'descamacao',
  'vermelhidao',
  'coceira',
  'sensibilidade',
  'dermatite',
  'psoriase',
  'seborreia',
  'foliculite',
] as const;

const TERAPIA_CAPILAR_FIOS_BOOLEAN_KEYS = ['quebra_fios', 'ressecamento', 'pontas_duplas'] as const;

export type ProcedureFieldRenderItem =
  | { kind: 'single'; field: ProcedureFieldRow }
  | { kind: 'boolean_group'; title: string; fields: ProcedureFieldRow[] };

export function buildProcedureFieldRenderPlan(
  slug: string,
  fields: ProcedureFieldRow[]
): ProcedureFieldRenderItem[] {
  if (slug !== 'terapia-capilar') {
    return fields.map((field) => ({ kind: 'single', field }));
  }

  const couroKeys = new Set<string>(TERAPIA_CAPILAR_COUPO_CABELO_BOOLEAN_KEYS);
  const fiosKeys = new Set<string>(TERAPIA_CAPILAR_FIOS_BOOLEAN_KEYS);
  const consumed = new Set<string>();
  const plan: ProcedureFieldRenderItem[] = [];

  for (const field of fields) {
    if (consumed.has(field.field_key)) continue;

    if (couroKeys.has(field.field_key)) {
      const groupFields = fields.filter((f) => couroKeys.has(f.field_key));
      groupFields.forEach((f) => consumed.add(f.field_key));
      plan.push({ kind: 'boolean_group', title: 'Sinais do couro cabeludo', fields: groupFields });
      continue;
    }

    if (fiosKeys.has(field.field_key)) {
      const groupFields = fields.filter((f) => fiosKeys.has(f.field_key));
      groupFields.forEach((f) => consumed.add(f.field_key));
      plan.push({ kind: 'boolean_group', title: 'Sinais dos fios', fields: groupFields });
      continue;
    }

    plan.push({ kind: 'single', field });
  }

  return plan;
}

export function isProcedureFieldFullWidthOnDesktop(
  field: ProcedureFieldRow,
  slug: string
): boolean {
  if (field.field_type === 'select_multi') return true;

  const isPeim = slug === 'peim';
  const isPreenchimento = slug === 'preenchimento-facial';
  const isTerapiaCapilar = slug === 'terapia-capilar';
  const isLipoenzimatica = slug === 'lipoenzimatica';

  if (FULL_WIDTH_FIELD_LABELS.includes(field.label as (typeof FULL_WIDTH_FIELD_LABELS)[number])) {
    return true;
  }

  if (isPeim && PEIM_FULL_WIDTH_FIELD_KEYS.includes(field.field_key as (typeof PEIM_FULL_WIDTH_FIELD_KEYS)[number])) {
    return true;
  }

  if (
    isTerapiaCapilar &&
    TERAPIA_CAPILAR_FULL_WIDTH_FIELD_KEYS.includes(
      field.field_key as (typeof TERAPIA_CAPILAR_FULL_WIDTH_FIELD_KEYS)[number]
    )
  ) {
    return true;
  }

  if (isLipoenzimatica) {
    return [
      'intercorrencias',
      'conduta',
      'observacoes_profissional',
      'orientacoes_pos',
      'regiao_anatomica_detalhada',
    ].includes(field.field_key);
  }

  return isPreenchimento && field.field_key === 'plano_aplicacao';
}
