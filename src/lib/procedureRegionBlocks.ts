export type RegionFieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date';
};

export type RegionBlockItem = {
  id: string;
  area_key: string;
  nome_area: string;
  [key: string]: string;
};

export const ENZIMAS_SLUG = 'enzimas' as const;
export const I_LIPO_SLUG = 'i-lipo' as const;
export const ULTRASSOM_MACRO_SLUG = 'ultrassom-macrofocado' as const;

export const REGION_AREAS_STORAGE_KEY = 'areas';
export const REGION_HIDDEN_FIELD_KEYS = ['areas_tratadas'] as const;

export const ENZIMAS_REGIONS = [
  { key: 'abdomen', label: 'Abdômen' },
  { key: 'flancos', label: 'Flancos' },
  { key: 'culote', label: 'Culote' },
  { key: 'coxas', label: 'Coxas' },
  { key: 'bracos', label: 'Braços' },
  { key: 'papada', label: 'Papada' },
  { key: 'costas', label: 'Costas' },
  { key: 'gluteos', label: 'Glúteos' },
  { key: 'outra', label: 'Outra região' },
] as const;

export const ENZIMAS_FIELDS: RegionFieldDef[] = [
  { key: 'volume_aplicado', label: 'Volume aplicado', type: 'number' },
  { key: 'numero_pontos', label: 'Número de pontos', type: 'number' },
  { key: 'tecnica_aplicacao', label: 'Técnica de aplicação' },
  { key: 'agulha_canula', label: 'Agulha ou cânula' },
  { key: 'anestesico', label: 'Anestésico' },
  { key: 'observacoes', label: 'Observações' },
];

export const I_LIPO_REGIONS = [
  { key: 'abdomen', label: 'Abdômen' },
  { key: 'flancos', label: 'Flancos' },
  { key: 'bracos', label: 'Braços' },
  { key: 'coxas', label: 'Coxas' },
  { key: 'culote', label: 'Culote' },
  { key: 'gluteos', label: 'Glúteos' },
  { key: 'outra', label: 'Outra região' },
] as const;

export const I_LIPO_FIELDS: RegionFieldDef[] = [
  { key: 'ponteira', label: 'Ponteira ou aplicador' },
  { key: 'tempo_aplicacao', label: 'Tempo de aplicação' },
  { key: 'intensidade', label: 'Intensidade' },
  { key: 'medida_antes', label: 'Medida antes', type: 'number' },
  { key: 'medida_depois', label: 'Medida depois', type: 'number' },
  { key: 'observacoes', label: 'Observações' },
];

export const ULTRASSOM_MACRO_REGIONS = [
  { key: 'abdomen', label: 'Abdômen' },
  { key: 'flancos', label: 'Flancos' },
  { key: 'bracos', label: 'Braços' },
  { key: 'coxas', label: 'Coxas' },
  { key: 'gluteos', label: 'Glúteos' },
  { key: 'papada', label: 'Papada' },
  { key: 'outra', label: 'Outra região' },
] as const;

export const ULTRASSOM_MACRO_FIELDS: RegionFieldDef[] = [
  { key: 'ponteira', label: 'Ponteira' },
  { key: 'profundidade', label: 'Profundidade' },
  { key: 'energia', label: 'Energia utilizada' },
  { key: 'numero_disparos', label: 'Número de disparos', type: 'number' },
  { key: 'quantidade_linhas', label: 'Quantidade de linhas', type: 'number' },
  { key: 'observacoes', label: 'Observações' },
];

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function isRegionProcedureSlug(slug: string): boolean {
  return slug === ENZIMAS_SLUG || slug === I_LIPO_SLUG || slug === ULTRASSOM_MACRO_SLUG;
}

export function getRegionConfig(slug: string): {
  regions: readonly { key: string; label: string }[];
  fields: RegionFieldDef[];
} | null {
  if (slug === ENZIMAS_SLUG) return { regions: ENZIMAS_REGIONS, fields: ENZIMAS_FIELDS };
  if (slug === I_LIPO_SLUG) return { regions: I_LIPO_REGIONS, fields: I_LIPO_FIELDS };
  if (slug === ULTRASSOM_MACRO_SLUG) {
    return { regions: ULTRASSOM_MACRO_REGIONS, fields: ULTRASSOM_MACRO_FIELDS };
  }
  return null;
}

export function isRegionHiddenFieldKey(fieldKey: string): boolean {
  return (REGION_HIDDEN_FIELD_KEYS as readonly string[]).includes(fieldKey);
}

export function createEmptyRegionItem(areaKey: string, fields: RegionFieldDef[]): RegionBlockItem {
  const item: RegionBlockItem = {
    id: crypto.randomUUID(),
    area_key: areaKey,
    nome_area: '',
  };
  for (const f of fields) item[f.key] = '';
  return item;
}

export function regionItemHasData(item: RegionBlockItem, fields: RegionFieldDef[]): boolean {
  if (item.nome_area.trim()) return true;
  return fields.some((f) => str(item[f.key]).trim().length > 0);
}

export function parseRegionItems(value: unknown, fields: RegionFieldDef[]): RegionBlockItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const o = raw as Record<string, unknown>;
      const areaKey = str(o.area_key).trim();
      if (!areaKey) return null;
      const item = createEmptyRegionItem(areaKey, fields);
      if (typeof o.id === 'string' && o.id.trim()) item.id = o.id;
      item.nome_area = str(o.nome_area);
      for (const f of fields) item[f.key] = str(o[f.key]);
      return item;
    })
    .filter((i): i is RegionBlockItem => i != null);
}

export function getRegionItemsForForm(
  data: Record<string, unknown> | undefined,
  fields: RegionFieldDef[]
): RegionBlockItem[] {
  return parseRegionItems(data?.[REGION_AREAS_STORAGE_KEY], fields);
}

export function serializeRegionSessionData(
  data: Record<string, unknown>,
  fields: RegionFieldDef[]
): Record<string, unknown> {
  const items = parseRegionItems(data[REGION_AREAS_STORAGE_KEY], fields).map((item) => {
    const { id: _id, ...rest } = item;
    void _id;
    return rest;
  });
  const rest = { ...data };
  delete rest.areas_tratadas;
  rest[REGION_AREAS_STORAGE_KEY] = items;
  return rest;
}

export function validateRegionSessionData(
  data: Record<string, unknown>,
  fields: RegionFieldDef[]
): string | null {
  const items = parseRegionItems(data[REGION_AREAS_STORAGE_KEY], fields);
  if (items.length === 0) return 'Selecione pelo menos uma região tratada.';
  for (const item of items) {
    if (item.area_key === 'outra' && !item.nome_area.trim()) {
      return 'Informe a descrição da “Outra região”.';
    }
    for (const f of fields) {
      const v = str(item[f.key]).trim();
      if (f.type === 'number' && v && Number(v) < 0) {
        return 'Valores numéricos não podem ser negativos.';
      }
    }
  }
  return null;
}
