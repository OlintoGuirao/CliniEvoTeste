import {
  isLowerArchTooth,
  isUpperArchTooth,
  type DentalArchRegion,
} from '@/lib/dentalFdi';
import type { DentalSelectionType } from '@/lib/dentalSelection';

export type DentalQuickProcedureKey =
  | 'consulta'
  | 'limpeza'
  | 'restauracao'
  | 'canal'
  | 'extracao'
  | 'coroa'
  | 'implante'
  | 'fluor';

export type DentalQuickProcedurePreset = {
  key: DentalQuickProcedureKey;
  label: string;
  /** Termos para casar com o catálogo `procedures.name`. */
  searchTerms: string[];
  defaultName: string;
  selectionType: DentalSelectionType;
  /** Limpa faces → localização “dente inteiro”. */
  wholeTooth?: boolean;
  /** Exige/prioriza faces (restauração). */
  needFaces?: boolean;
  /** Abre como região (limpeza, flúor). */
  useRegion?: boolean;
  /** Preferir dentes ausentes (implante). */
  preferAbsent?: boolean;
  hint: string;
};

export const DENTAL_QUICK_PROCEDURES: DentalQuickProcedurePreset[] = [
  {
    key: 'consulta',
    label: 'Consulta',
    searchTerms: ['consulta de avaliação', 'consulta odontológica', 'consulta odontologica', 'consulta'],
    defaultName: 'Consulta de Avaliação Odontológica Digital',
    selectionType: 'individual',
    wholeTooth: true,
    hint: 'Dente selecionado (inteiro).',
  },
  {
    key: 'limpeza',
    label: 'Limpeza',
    searchTerms: ['limpeza i -', 'limpeza', 'profilaxia', 'tartarotomia'],
    defaultName: 'Limpeza I - Limpeza + Tartarotomia I + Profilaxia',
    selectionType: 'region',
    useRegion: true,
    hint: 'Tipo Região (arcada inferida pela seleção).',
  },
  {
    key: 'restauracao',
    label: 'Restauração',
    searchTerms: ['restauração - rc foto', 'restaura', 'restauração', 'obtur'],
    defaultName: 'Restauração - RC Foto I',
    selectionType: 'individual',
    needFaces: true,
    hint: 'Individual · Dente + face.',
  },
  {
    key: 'canal',
    label: 'Canal',
    searchTerms: ['endodontia molar', 'endodont', 'canal'],
    defaultName: 'Endodontia Molar',
    selectionType: 'individual',
    wholeTooth: true,
    hint: 'Dente inteiro (sem face).',
  },
  {
    key: 'extracao',
    label: 'Extração',
    searchTerms: ['exodontia i', 'exodont', 'extração', 'extracao'],
    defaultName: 'Exodontia I',
    selectionType: 'individual',
    wholeTooth: true,
    hint: 'Dente inteiro.',
  },
  {
    key: 'coroa',
    label: 'Coroa',
    searchTerms: ['coroa total', 'coroa'],
    defaultName: 'Coroa Total em Cerâmica Pura',
    selectionType: 'individual',
    wholeTooth: true,
    hint: 'Dente inteiro.',
  },
  {
    key: 'implante',
    label: 'Implante',
    searchTerms: ['implante unitário - parte cirúrgica', 'implante unitario', 'implante'],
    defaultName: 'Implante Unitário - Parte Cirúrgica',
    selectionType: 'individual',
    wholeTooth: true,
    preferAbsent: true,
    hint: 'Preferir dente ausente ou região.',
  },
  {
    key: 'fluor',
    label: 'Aplicação de flúor',
    searchTerms: ['flúor', 'fluor', 'fluoreto'],
    defaultName: 'Aplicação de flúor',
    selectionType: 'region',
    useRegion: true,
    hint: 'Tipo Região.',
  },
];

export function inferRegionFromTeeth(teeth: string[]): DentalArchRegion {
  const upper = teeth.some((t) => isUpperArchTooth(t));
  const lower = teeth.some((t) => isLowerArchTooth(t));
  if (upper && lower) return 'both_arches';
  if (lower) return 'lower_arch';
  return 'upper_arch';
}

export function matchCatalogProcedure<T extends { id: string; name: string; specialty?: string | null }>(
  catalog: T[],
  preset: DentalQuickProcedurePreset
): T | null {
  const terms = preset.searchTerms.map((t) => t.toLowerCase());
  let best: { item: T; score: number } | null = null;
  for (const p of catalog) {
    const name = p.name.toLowerCase();
    for (const t of terms) {
      if (!name.includes(t)) continue;
      const score = t.length;
      if (!best || score > best.score) best = { item: p, score };
    }
  }
  return best?.item ?? null;
}

export function resolveQuickProcedureContext(params: {
  preset: DentalQuickProcedurePreset;
  selectedTeeth: string[];
  hasFaces: boolean;
  absentTeeth: string[];
}): {
  selectionType: DentalSelectionType;
  region?: DentalArchRegion;
  clearFaces: boolean;
  toastHint?: string;
  blockReason?: string;
} {
  const { preset, selectedTeeth, hasFaces, absentTeeth } = params;

  if (preset.useRegion) {
    return {
      selectionType: 'region',
      region: inferRegionFromTeeth(selectedTeeth),
      clearFaces: true,
      toastHint: preset.hint,
    };
  }

  if (preset.preferAbsent) {
    const absentSelected = selectedTeeth.filter((t) => absentTeeth.includes(t));
    if (absentSelected.length === 0 && selectedTeeth.length > 0) {
      return {
        selectionType: selectedTeeth.length > 1 ? 'group' : 'individual',
        clearFaces: true,
        toastHint:
          'Implante: preferível em dente ausente. Você pode marcar como ausente ou usar região.',
      };
    }
    if (selectedTeeth.length === 0) {
      return {
        selectionType: 'region',
        region: 'both_arches',
        clearFaces: true,
        toastHint: 'Implante por região — ajuste a arcada se necessário.',
      };
    }
    return {
      selectionType: absentSelected.length > 1 || selectedTeeth.length > 1 ? 'group' : 'individual',
      clearFaces: true,
      toastHint: preset.hint,
    };
  }

  if (selectedTeeth.length === 0) {
    return {
      selectionType: 'region',
      region: 'upper_arch',
      clearFaces: true,
      blockReason: undefined,
      toastHint: 'Nenhum dente selecionado — abrindo como região.',
    };
  }

  if (preset.needFaces && !hasFaces) {
    return {
      selectionType: 'individual',
      clearFaces: false,
      toastHint: 'Restauração: selecione a(s) face(s) no painel ou no formulário.',
    };
  }

  const selectionType: DentalSelectionType =
    selectedTeeth.length > 1 && preset.selectionType === 'individual'
      ? 'individual'
      : selectedTeeth.length > 1
        ? 'group'
        : preset.selectionType;

  return {
    selectionType,
    clearFaces: !!preset.wholeTooth,
    toastHint: preset.hint,
  };
}
