export const LIPOENZIMATICA_SLUG = 'lipoenzimatica' as const;

export const LIPOENZIMATICA_AREAS_STORAGE_KEY = 'areas';
export const LIPOENZIMATICA_PRODUTOS_STORAGE_KEY = 'produtos';

/** Campos flat substituídos pela UI custom (não renderizar Input genérico). */
export const LIPOENZIMATICA_HIDDEN_FIELD_KEYS = [
  'areas_tratadas',
  'produtos_utilizados',
] as const;

export const LIPOENZIMATICA_AREA_OPTIONS = [
  { key: 'abdomen', label: 'Abdômen' },
  { key: 'flancos', label: 'Flancos' },
  { key: 'culote', label: 'Culote' },
  { key: 'coxas_internas', label: 'Coxas internas' },
  { key: 'coxas_externas', label: 'Coxas externas' },
  { key: 'bracos', label: 'Braços' },
  { key: 'costas', label: 'Costas' },
  { key: 'papada', label: 'Papada' },
  { key: 'joelhos', label: 'Joelhos' },
  { key: 'gluteos', label: 'Glúteos' },
  { key: 'outra', label: 'Outra área' },
] as const;

export type LipoenzimaticaAreaKey = (typeof LIPOENZIMATICA_AREA_OPTIONS)[number]['key'];

export const LIPOENZIMATICA_LADO_OPTIONS = [
  { value: 'direito', label: 'Direito' },
  { value: 'esquerdo', label: 'Esquerdo' },
  { value: 'bilateral', label: 'Bilateral' },
  { value: 'central', label: 'Central' },
] as const;

export type LipoenzimaticaLado = (typeof LIPOENZIMATICA_LADO_OPTIONS)[number]['value'];

export type LipoenzimaticaAreaItem = {
  id: string;
  area_key: LipoenzimaticaAreaKey;
  nome_area: string;
  descricao_anatomica: string;
  lado: LipoenzimaticaLado | '';
  quantidade_pontos: string;
  volume_aplicado: string;
  produto_utilizado: string;
  concentracao: string;
  observacoes: string;
  foto_url: string;
};

export type LipoenzimaticaAreaStored = Omit<LipoenzimaticaAreaItem, 'id'>;

export type LipoenzimaticaProdutoItem = {
  id: string;
  nome: string;
  principio_ativo: string;
  fabricante: string;
  lote: string;
  validade: string;
  quantidade_total: string;
  unidade: string;
  diluicao: string;
  via_tecnica: string;
  responsavel_preparacao: string;
  observacoes: string;
};

export type LipoenzimaticaProdutoStored = Omit<LipoenzimaticaProdutoItem, 'id'>;

const AREA_KEY_SET = new Set<string>(LIPOENZIMATICA_AREA_OPTIONS.map((a) => a.key));
const LADO_SET = new Set<string>(LIPOENZIMATICA_LADO_OPTIONS.map((l) => l.value));

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function getLipoenzimaticaAreaLabel(key: LipoenzimaticaAreaKey): string {
  return LIPOENZIMATICA_AREA_OPTIONS.find((a) => a.key === key)?.label ?? key;
}

export function createEmptyLipoenzimaticaAreaItem(
  areaKey: LipoenzimaticaAreaKey
): LipoenzimaticaAreaItem {
  return {
    id: crypto.randomUUID(),
    area_key: areaKey,
    nome_area: '',
    descricao_anatomica: '',
    lado: '',
    quantidade_pontos: '',
    volume_aplicado: '',
    produto_utilizado: '',
    concentracao: '',
    observacoes: '',
    foto_url: '',
  };
}

export function createEmptyLipoenzimaticaProdutoItem(): LipoenzimaticaProdutoItem {
  return {
    id: crypto.randomUUID(),
    nome: '',
    principio_ativo: '',
    fabricante: '',
    lote: '',
    validade: '',
    quantidade_total: '',
    unidade: 'ml',
    diluicao: '',
    via_tecnica: '',
    responsavel_preparacao: '',
    observacoes: '',
  };
}

export function isLipoenzimaticaHiddenFieldKey(fieldKey: string): boolean {
  return (LIPOENZIMATICA_HIDDEN_FIELD_KEYS as readonly string[]).includes(fieldKey);
}

export function lipoenzimaticaAreaHasData(item: LipoenzimaticaAreaItem | LipoenzimaticaAreaStored): boolean {
  const fields = [
    item.nome_area,
    item.descricao_anatomica,
    item.lado,
    item.quantidade_pontos,
    item.volume_aplicado,
    item.produto_utilizado,
    item.concentracao,
    item.observacoes,
    item.foto_url,
  ];
  return fields.some((v) => str(v).trim().length > 0);
}

function parseAreaRow(raw: unknown, fallbackId?: string): LipoenzimaticaAreaItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const areaKey = str(o.area_key).trim();
  if (!AREA_KEY_SET.has(areaKey)) return null;
  const ladoRaw = str(o.lado).trim().toLowerCase();
  const lado = (LADO_SET.has(ladoRaw) ? ladoRaw : '') as LipoenzimaticaLado | '';
  const idFromRaw = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : null;
  const item: LipoenzimaticaAreaItem = {
    id: idFromRaw ?? fallbackId ?? crypto.randomUUID(),
    area_key: areaKey as LipoenzimaticaAreaKey,
    nome_area: str(o.nome_area),
    descricao_anatomica: str(o.descricao_anatomica),
    lado,
    quantidade_pontos: str(o.quantidade_pontos),
    volume_aplicado: str(o.volume_aplicado),
    produto_utilizado: str(o.produto_utilizado),
    concentracao: str(o.concentracao),
    observacoes: str(o.observacoes),
    foto_url: str(o.foto_url),
  };
  return item;
}

export function parseLipoenzimaticaAreas(value: unknown): LipoenzimaticaAreaItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => parseAreaRow(item))
    .filter((item): item is LipoenzimaticaAreaItem => item != null);
}

function parseProdutoRow(raw: unknown, fallbackId?: string): LipoenzimaticaProdutoItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const idFromRaw = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : null;
  const item: LipoenzimaticaProdutoItem = {
    id: idFromRaw ?? fallbackId ?? crypto.randomUUID(),
    nome: str(o.nome),
    principio_ativo: str(o.principio_ativo),
    fabricante: str(o.fabricante),
    lote: str(o.lote),
    validade: str(o.validade),
    quantidade_total: str(o.quantidade_total),
    unidade: str(o.unidade) || 'ml',
    diluicao: str(o.diluicao),
    via_tecnica: str(o.via_tecnica),
    responsavel_preparacao: str(o.responsavel_preparacao),
    observacoes: str(o.observacoes),
  };
  const hasContent = [
    item.nome,
    item.principio_ativo,
    item.fabricante,
    item.lote,
    item.validade,
    item.quantidade_total,
    item.diluicao,
    item.via_tecnica,
    item.responsavel_preparacao,
    item.observacoes,
  ].some((v) => v.trim().length > 0);
  if (!hasContent && !idFromRaw && !fallbackId) return null;
  return item;
}

export function parseLipoenzimaticaProdutos(value: unknown): LipoenzimaticaProdutoItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => parseProdutoRow(item))
    .filter((item): item is LipoenzimaticaProdutoItem => item != null);
}

export function getLipoenzimaticaAreasForForm(
  data: Record<string, unknown> | undefined
): LipoenzimaticaAreaItem[] {
  return parseLipoenzimaticaAreas(data?.[LIPOENZIMATICA_AREAS_STORAGE_KEY]);
}

export function getLipoenzimaticaProdutosForForm(
  data: Record<string, unknown> | undefined
): LipoenzimaticaProdutoItem[] {
  const parsed = parseLipoenzimaticaProdutos(data?.[LIPOENZIMATICA_PRODUTOS_STORAGE_KEY]);
  if (parsed.length > 0) return parsed;
  return [createEmptyLipoenzimaticaProdutoItem()];
}

export function ensureLipoenzimaticaSessionData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const areas = parseLipoenzimaticaAreas(data[LIPOENZIMATICA_AREAS_STORAGE_KEY]);
  const produtos = parseLipoenzimaticaProdutos(data[LIPOENZIMATICA_PRODUTOS_STORAGE_KEY]);
  return {
    ...data,
    [LIPOENZIMATICA_AREAS_STORAGE_KEY]: areas,
    [LIPOENZIMATICA_PRODUTOS_STORAGE_KEY]:
      produtos.length > 0 ? produtos : [createEmptyLipoenzimaticaProdutoItem()],
  };
}

export function normalizeLipoenzimaticaSessionData(
  data: Record<string, unknown>
): Record<string, unknown> {
  return ensureLipoenzimaticaSessionData(data);
}

function sanitizeArea(item: LipoenzimaticaAreaItem): LipoenzimaticaAreaStored | null {
  const row: LipoenzimaticaAreaStored = {
    area_key: item.area_key,
    nome_area: item.nome_area.trim(),
    descricao_anatomica: item.descricao_anatomica.trim(),
    lado: item.lado,
    quantidade_pontos: item.quantidade_pontos.trim(),
    volume_aplicado: item.volume_aplicado.trim(),
    produto_utilizado: item.produto_utilizado.trim(),
    concentracao: item.concentracao.trim(),
    observacoes: item.observacoes.trim(),
    foto_url: item.foto_url.trim(),
  };
  // Área marcada entra mesmo sem campos extras (checkbox = intenção de tratar)
  return row;
}

function sanitizeProduto(item: LipoenzimaticaProdutoItem): LipoenzimaticaProdutoStored | null {
  const row: LipoenzimaticaProdutoStored = {
    nome: item.nome.trim(),
    principio_ativo: item.principio_ativo.trim(),
    fabricante: item.fabricante.trim(),
    lote: item.lote.trim(),
    validade: item.validade.trim(),
    quantidade_total: item.quantidade_total.trim(),
    unidade: (item.unidade.trim() || 'ml'),
    diluicao: item.diluicao.trim(),
    via_tecnica: item.via_tecnica.trim(),
    responsavel_preparacao: item.responsavel_preparacao.trim(),
    observacoes: item.observacoes.trim(),
  };
  const hasContent = [
    row.nome,
    row.principio_ativo,
    row.fabricante,
    row.lote,
    row.validade,
    row.quantidade_total,
    row.diluicao,
    row.via_tecnica,
    row.responsavel_preparacao,
    row.observacoes,
  ].some((v) => v.length > 0);
  return hasContent ? row : null;
}

export function serializeLipoenzimaticaSessionData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const normalized = normalizeLipoenzimaticaSessionData(data);
  const areas = parseLipoenzimaticaAreas(normalized[LIPOENZIMATICA_AREAS_STORAGE_KEY])
    .map(sanitizeArea)
    .filter((r): r is LipoenzimaticaAreaStored => r != null);
  const produtos = parseLipoenzimaticaProdutos(normalized[LIPOENZIMATICA_PRODUTOS_STORAGE_KEY])
    .map(sanitizeProduto)
    .filter((r): r is LipoenzimaticaProdutoStored => r != null);

  const rest = { ...normalized };
  for (const key of LIPOENZIMATICA_HIDDEN_FIELD_KEYS) {
    delete rest[key];
  }
  rest[LIPOENZIMATICA_AREAS_STORAGE_KEY] = areas;
  if (produtos.length > 0) {
    rest[LIPOENZIMATICA_PRODUTOS_STORAGE_KEY] = produtos;
  } else {
    delete rest[LIPOENZIMATICA_PRODUTOS_STORAGE_KEY];
  }
  return rest;
}

/** Retorna mensagem de erro ou null se válido. */
export function validateLipoenzimaticaSessionData(
  data: Record<string, unknown>
): string | null {
  const areas = parseLipoenzimaticaAreas(data[LIPOENZIMATICA_AREAS_STORAGE_KEY]);
  if (areas.length === 0) {
    return 'Selecione pelo menos uma área tratada.';
  }

  for (const area of areas) {
    if (area.area_key === 'outra' && !area.nome_area.trim()) {
      return 'Informe o nome da “Outra área”.';
    }
    const hasVolume = area.volume_aplicado.trim().length > 0;
    const hasPontos = area.quantidade_pontos.trim().length > 0;
    if (!hasVolume && !hasPontos) {
      return `Informe volume ou quantidade de pontos em ${getLipoenzimaticaAreaLabel(area.area_key)}.`;
    }
  }

  const produtos = parseLipoenzimaticaProdutos(data[LIPOENZIMATICA_PRODUTOS_STORAGE_KEY]);
  const produtosOk = produtos.filter(
    (p) => p.nome.trim() && p.lote.trim() && p.validade.trim() && p.quantidade_total.trim()
  );
  if (produtosOk.length === 0) {
    return 'Adicione pelo menos um produto com nome, lote, validade e quantidade.';
  }

  const contraindicacoes = data.contraindicacoes;
  const hasContra =
    (Array.isArray(contraindicacoes) && contraindicacoes.length > 0) ||
    (typeof contraindicacoes === 'string' && contraindicacoes.trim().length > 0);
  if (!hasContra) {
    return 'Registre as contraindicações (ou selecione “Nenhuma”).';
  }

  if (!str(data.orientacoes_pos).trim()) {
    return 'Preencha as orientações pós-procedimento.';
  }

  if (!str(data.intercorrencias).trim()) {
    return 'Registre as intercorrências (ou informe “sem intercorrências”).';
  }

  return null;
}
