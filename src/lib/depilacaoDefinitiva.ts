export const DEPILACAO_DEFINITIVA_FEM_SLUG = 'depilacao-definitiva-feminina' as const;
export const DEPILACAO_DEFINITIVA_MASC_SLUG = 'depilacao-definitiva-masculina' as const;

export const DEPILACAO_DEFINITIVA_SLUGS = [
  DEPILACAO_DEFINITIVA_FEM_SLUG,
  DEPILACAO_DEFINITIVA_MASC_SLUG,
] as const;

export type DepilacaoDefinitivaSlug = (typeof DEPILACAO_DEFINITIVA_SLUGS)[number];

export const DEPILACAO_AREAS_STORAGE_KEY = 'areas';

export const DEPILACAO_HIDDEN_FIELD_KEYS = ['areas_tratadas'] as const;

export const DEPILACAO_AREAS_FEM = [
  { key: 'buco', label: 'Buço' },
  { key: 'rosto', label: 'Rosto' },
  { key: 'axila', label: 'Axila' },
  { key: 'braco', label: 'Braço' },
  { key: 'barriga', label: 'Barriga' },
  { key: 'virilha_completa', label: 'Virilha completa' },
  { key: 'virilha_cavada', label: 'Virilha cavada' },
  { key: 'meia_perna', label: 'Meia perna' },
  { key: 'perna_completa', label: 'Perna completa' },
  { key: 'corpo_todo', label: 'Corpo todo' },
  { key: 'outra', label: 'Outra área' },
] as const;

export const DEPILACAO_AREAS_MASC = [
  { key: 'barba', label: 'Barba' },
  { key: 'rosto', label: 'Rosto' },
  { key: 'axila', label: 'Axila' },
  { key: 'braco', label: 'Braço' },
  { key: 'barriga', label: 'Barriga' },
  { key: 'peito', label: 'Peito' },
  { key: 'costas', label: 'Costas' },
  { key: 'virilha', label: 'Virilha' },
  { key: 'meia_perna', label: 'Meia perna' },
  { key: 'perna_completa', label: 'Perna completa' },
  { key: 'corpo_todo', label: 'Corpo todo' },
  { key: 'outra', label: 'Outra área' },
] as const;

export type DepilacaoAreaOption = { key: string; label: string };

export type DepilacaoAreaItem = {
  id: string;
  area_key: string;
  nome_area: string;
  numero_sessao: string;
  data_sessao: string;
  equipamento: string;
  ponteira: string;
  frequencia_equipamento: string;
  potencia_energia: string;
  quantidade_disparos: string;
  tempo_aplicacao: string;
  reacao_pele: string;
  intercorrencias: string;
  observacoes: string;
  data_proxima_sessao: string;
  assinatura_data: string;
  assinatura_status: 'pendente' | 'assinada' | 'recusada' | 'cancelada';
  assinatura_em: string;
};

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function isDepilacaoDefinitivaSlug(slug: string): slug is DepilacaoDefinitivaSlug {
  return (DEPILACAO_DEFINITIVA_SLUGS as readonly string[]).includes(slug);
}

export function getDepilacaoAreaOptions(slug: string): readonly DepilacaoAreaOption[] {
  if (slug === DEPILACAO_DEFINITIVA_MASC_SLUG) return DEPILACAO_AREAS_MASC;
  return DEPILACAO_AREAS_FEM;
}

export function getDepilacaoAreaLabel(slug: string, areaKey: string, nomeArea?: string): string {
  if (areaKey === 'outra' && nomeArea?.trim()) return nomeArea.trim();
  const opt = getDepilacaoAreaOptions(slug).find((a) => a.key === areaKey);
  return opt?.label ?? areaKey;
}

export function isDepilacaoHiddenFieldKey(fieldKey: string): boolean {
  return (DEPILACAO_HIDDEN_FIELD_KEYS as readonly string[]).includes(fieldKey);
}

export function createEmptyDepilacaoAreaItem(areaKey: string, sessionDate = ''): DepilacaoAreaItem {
  return {
    id: crypto.randomUUID(),
    area_key: areaKey,
    nome_area: '',
    numero_sessao: '1',
    data_sessao: sessionDate,
    equipamento: '',
    ponteira: '',
    frequencia_equipamento: '',
    potencia_energia: '',
    quantidade_disparos: '',
    tempo_aplicacao: '',
    reacao_pele: '',
    intercorrencias: '',
    observacoes: '',
    data_proxima_sessao: '',
    assinatura_data: '',
    assinatura_status: 'pendente',
    assinatura_em: '',
  };
}

export function depilacaoAreaHasData(item: DepilacaoAreaItem): boolean {
  return [
    item.nome_area,
    item.numero_sessao && item.numero_sessao !== '1' ? item.numero_sessao : '',
    item.equipamento,
    item.ponteira,
    item.frequencia_equipamento,
    item.potencia_energia,
    item.quantidade_disparos,
    item.tempo_aplicacao,
    item.reacao_pele,
    item.intercorrencias,
    item.observacoes,
    item.data_proxima_sessao,
    item.assinatura_data,
  ].some((v) => str(v).trim().length > 0);
}

function parseArea(raw: unknown): DepilacaoAreaItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const areaKey = str(o.area_key).trim();
  if (!areaKey) return null;
  const statusRaw = str(o.assinatura_status).trim() || 'pendente';
  const status = (['pendente', 'assinada', 'recusada', 'cancelada'].includes(statusRaw)
    ? statusRaw
    : 'pendente') as DepilacaoAreaItem['assinatura_status'];
  return {
    id: typeof o.id === 'string' && o.id.trim() ? o.id : crypto.randomUUID(),
    area_key: areaKey,
    nome_area: str(o.nome_area),
    numero_sessao: str(o.numero_sessao) || '1',
    data_sessao: str(o.data_sessao),
    equipamento: str(o.equipamento),
    ponteira: str(o.ponteira),
    frequencia_equipamento: str(o.frequencia_equipamento),
    potencia_energia: str(o.potencia_energia),
    quantidade_disparos: str(o.quantidade_disparos),
    tempo_aplicacao: str(o.tempo_aplicacao),
    reacao_pele: str(o.reacao_pele),
    intercorrencias: str(o.intercorrencias),
    observacoes: str(o.observacoes),
    data_proxima_sessao: str(o.data_proxima_sessao),
    assinatura_data: str(o.assinatura_data),
    assinatura_status: status,
    assinatura_em: str(o.assinatura_em),
  };
}

export function parseDepilacaoAreas(value: unknown): DepilacaoAreaItem[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseArea).filter((a): a is DepilacaoAreaItem => a != null);
}

export function getDepilacaoAreasForForm(data: Record<string, unknown> | undefined): DepilacaoAreaItem[] {
  return parseDepilacaoAreas(data?.[DEPILACAO_AREAS_STORAGE_KEY]);
}

export function normalizeDepilacaoSessionData(data: Record<string, unknown>): Record<string, unknown> {
  return {
    ...data,
    [DEPILACAO_AREAS_STORAGE_KEY]: parseDepilacaoAreas(data[DEPILACAO_AREAS_STORAGE_KEY]),
  };
}

export function serializeDepilacaoSessionData(data: Record<string, unknown>): Record<string, unknown> {
  const areas = parseDepilacaoAreas(data[DEPILACAO_AREAS_STORAGE_KEY]).map((item) => {
    const { id: _id, ...rest } = item;
    void _id;
    return rest;
  });
  const rest = { ...data };
  delete rest.areas_tratadas;
  rest[DEPILACAO_AREAS_STORAGE_KEY] = areas;
  return rest;
}

export function validateDepilacaoSessionData(
  data: Record<string, unknown>,
  opts?: { requireSignature?: boolean }
): string | null {
  const areas = parseDepilacaoAreas(data[DEPILACAO_AREAS_STORAGE_KEY]);
  if (areas.length === 0) return 'Selecione pelo menos uma área tratada.';

  for (const area of areas) {
    if (area.area_key === 'outra' && !area.nome_area.trim()) {
      return 'Informe o nome da “Outra área”.';
    }
    const n = Number(area.numero_sessao);
    if (!Number.isFinite(n) || n < 1) {
      return `Número da sessão inválido na área ${area.area_key}.`;
    }
    if (!area.data_sessao.trim()) {
      return 'Informe a data da sessão em cada área.';
    }
    if (!area.frequencia_equipamento.trim() && !str(data.frequencia_equipamento).trim()) {
      return 'Informe a frequência da depilação (equipamento).';
    }
    const negatives = [
      area.quantidade_disparos,
      area.potencia_energia,
      area.tempo_aplicacao,
    ];
    for (const v of negatives) {
      if (v.trim() && Number(v) < 0) return 'Valores numéricos não podem ser negativos.';
    }
    if (opts?.requireSignature !== false) {
      if (area.assinatura_status !== 'assinada' || !area.assinatura_data.trim()) {
        return 'Assine cada área tratada antes de finalizar a sessão.';
      }
    }
  }
  return null;
}

/** Datas de próxima sessão por área (para criar lembretes). */
export function getDepilacaoReminderTargets(
  slug: string,
  data: Record<string, unknown>
): Array<{ area_key: string; area_label: string; due_date: string }> {
  return parseDepilacaoAreas(data[DEPILACAO_AREAS_STORAGE_KEY])
    .filter((a) => a.data_proxima_sessao.trim())
    .map((a) => ({
      area_key: a.area_key,
      area_label: getDepilacaoAreaLabel(slug, a.area_key, a.nome_area),
      due_date: a.data_proxima_sessao.trim().slice(0, 10),
    }));
}
