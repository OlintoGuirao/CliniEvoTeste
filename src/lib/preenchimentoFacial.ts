export const PREENCHIMENTO_APLICACAO_STORAGE_KEY = 'aplicacoes';

/** Campos repetíveis agrupados acima de "Plano de aplicação". */
export const PREENCHIMENTO_REPEATABLE_FIELD_KEYS = [
  'regiao_aplicada',
  'produto',
  'marca',
  'lote',
  'validade',
  'volume_total_ml',
  'tecnica',
] as const;

export type PreenchimentoRepeatableFieldKey = (typeof PREENCHIMENTO_REPEATABLE_FIELD_KEYS)[number];

export type PreenchimentoAplicacaoItem = {
  id: string;
  regiao_aplicada: string;
  produto: string;
  lote: string;
  validade: string;
  volume_total_ml: string;
  tecnica: string;
};

export type PreenchimentoAplicacaoStored = Omit<PreenchimentoAplicacaoItem, 'id'>;

const FIELD_LABELS: Record<PreenchimentoRepeatableFieldKey, string> = {
  regiao_aplicada: 'Região aplicada',
  produto: 'Produto',
  marca: 'Marca',
  lote: 'Lote',
  validade: 'Validade',
  volume_total_ml: 'Volume total (ml)',
  tecnica: 'Técnica',
};

/** Campos exibidos no bloco repetível (sem marca, conforme layout da consulta). */
export const PREENCHIMENTO_APLICACAO_FORM_FIELDS: PreenchimentoRepeatableFieldKey[] = [
  'regiao_aplicada',
  'produto',
  'lote',
  'validade',
  'volume_total_ml',
  'tecnica',
];

export function getPreenchimentoFieldLabel(key: PreenchimentoRepeatableFieldKey): string {
  return FIELD_LABELS[key];
}

export function createEmptyPreenchimentoAplicacaoItem(): PreenchimentoAplicacaoItem {
  return {
    id: crypto.randomUUID(),
    regiao_aplicada: '',
    produto: '',
    lote: '',
    validade: '',
    volume_total_ml: '',
    tecnica: '',
  };
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function rowFromUnknown(raw: unknown, fallbackId?: string): PreenchimentoAplicacaoItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const hasContent = PREENCHIMENTO_APLICACAO_FORM_FIELDS.some((k) => str(o[k]).trim());
  const idFromRaw = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : null;
  const id = idFromRaw ?? (fallbackId === 'legacy' ? 'legacy' : hasContent ? crypto.randomUUID() : null);
  if (!id) return null;
  return {
    id,
    regiao_aplicada: str(o.regiao_aplicada),
    produto: str(o.produto),
    lote: str(o.lote),
    validade: str(o.validade),
    volume_total_ml: str(o.volume_total_ml),
    tecnica: str(o.tecnica),
  };
}

function legacyRowFromFlat(data: Record<string, unknown>): PreenchimentoAplicacaoItem | null {
  const row = rowFromUnknown(
    {
      regiao_aplicada: data.regiao_aplicada,
      produto: data.produto,
      lote: data.lote,
      validade: data.validade,
      volume_total_ml: data.volume_total_ml,
      tecnica: data.tecnica,
      marca: data.marca,
    },
    'legacy'
  );
  return row;
}

export function parsePreenchimentoAplicacoes(value: unknown): PreenchimentoAplicacaoItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => rowFromUnknown(item))
    .filter((item): item is PreenchimentoAplicacaoItem => item != null);
}

/** Garante ao menos um bloco visível no formulário (sem criar ids novos a cada render). */
export function getPreenchimentoAplicacoesForForm(
  data: Record<string, unknown> | undefined
): PreenchimentoAplicacaoItem[] {
  const parsed = parsePreenchimentoAplicacoes(data?.[PREENCHIMENTO_APLICACAO_STORAGE_KEY]);
  if (parsed.length > 0) return parsed;
  return [createEmptyPreenchimentoAplicacaoItem()];
}

export function ensurePreenchimentoAplicacoesInData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const parsed = parsePreenchimentoAplicacoes(data[PREENCHIMENTO_APLICACAO_STORAGE_KEY]);
  if (parsed.length > 0) {
    return { ...data, [PREENCHIMENTO_APLICACAO_STORAGE_KEY]: parsed };
  }
  const legacy = legacyRowFromFlat(data);
  if (legacy) {
    return { ...data, [PREENCHIMENTO_APLICACAO_STORAGE_KEY]: [legacy] };
  }
  return {
    ...data,
    [PREENCHIMENTO_APLICACAO_STORAGE_KEY]: [createEmptyPreenchimentoAplicacaoItem()],
  };
}

export function normalizePreenchimentoFacialSessionData(
  data: Record<string, unknown>
): Record<string, unknown> {
  return ensurePreenchimentoAplicacoesInData(data);
}

function sanitizeRow(item: PreenchimentoAplicacaoItem): PreenchimentoAplicacaoStored | null {
  const row: PreenchimentoAplicacaoStored = {
    regiao_aplicada: item.regiao_aplicada.trim(),
    produto: item.produto.trim(),
    lote: item.lote.trim(),
    validade: item.validade.trim(),
    volume_total_ml: item.volume_total_ml.trim(),
    tecnica: item.tecnica.trim(),
  };
  const hasContent = Object.values(row).some((v) => v.length > 0);
  return hasContent ? row : null;
}

/** Remove campos soltos duplicados e grava apenas `aplicacoes` no JSON da sessão. */
export function serializePreenchimentoFacialSessionData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const normalized = normalizePreenchimentoFacialSessionData(data);
  const items = parsePreenchimentoAplicacoes(normalized[PREENCHIMENTO_APLICACAO_STORAGE_KEY]);
  const aplicacoes = items.map(sanitizeRow).filter((r): r is PreenchimentoAplicacaoStored => r != null);

  const rest = { ...normalized };
  for (const key of PREENCHIMENTO_REPEATABLE_FIELD_KEYS) {
    delete rest[key];
  }
  if (aplicacoes.length > 0) {
    rest[PREENCHIMENTO_APLICACAO_STORAGE_KEY] = aplicacoes;
  } else {
    delete rest[PREENCHIMENTO_APLICACAO_STORAGE_KEY];
  }
  return rest;
}

export function isPreenchimentoRepeatableFieldKey(fieldKey: string): boolean {
  return (PREENCHIMENTO_REPEATABLE_FIELD_KEYS as readonly string[]).includes(fieldKey);
}
