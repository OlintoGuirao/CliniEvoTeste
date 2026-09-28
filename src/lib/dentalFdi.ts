/** Numeração FDI — dentição permanente e decídua. */

export type DentalToothType = 'permanent' | 'deciduous';

export type DentalToothFace = 'M' | 'D' | 'V' | 'L' | 'P' | 'O' | 'I';

export type DentalArchRegion = 'upper_arch' | 'lower_arch' | 'both_arches';

export type DentalToothCondition =
  | 'ausencia_coroa'
  | 'ausente'
  | 'canal'
  | 'deciduo'
  | 'incluso'
  | 'microdente'
  | 'permanente'
  | 'semi_incluso'
  | 'supranumerario';

export const DENTAL_TOOTH_CONDITION_LABELS: Record<DentalToothCondition, string> = {
  ausencia_coroa: 'Ausência de coroa',
  ausente: 'Ausente',
  canal: 'Canal',
  deciduo: 'Decíduo',
  incluso: 'Incluso',
  microdente: 'Microdente',
  permanente: 'Permanente',
  semi_incluso: 'Semi-incluso',
  supranumerario: 'Supranumerário',
};

/** Permanente (quadrante) → decíduo correspondente (mesma posição). */
const PERMANENT_TO_DECIDUOUS: Record<string, string> = {
  '11': '51',
  '12': '52',
  '13': '53',
  '14': '54',
  '15': '55',
  '21': '61',
  '22': '62',
  '23': '63',
  '24': '64',
  '25': '65',
  '31': '71',
  '32': '72',
  '33': '73',
  '34': '74',
  '35': '75',
  '41': '81',
  '42': '82',
  '43': '83',
  '44': '84',
  '45': '85',
};

const DECIDUOUS_TO_PERMANENT: Record<string, string> = Object.fromEntries(
  Object.entries(PERMANENT_TO_DECIDUOUS).map(([perm, dec]) => [dec, perm])
);

export const PERMANENT_TEETH_FDI: readonly string[] = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '38', '37', '36', '35', '34', '33', '32', '31',
  '41', '42', '43', '44', '45', '46', '47', '48',
];

export const DECIDUOUS_TEETH_FDI: readonly string[] = [
  '55', '54', '53', '52', '51',
  '61', '62', '63', '64', '65',
  '75', '74', '73', '72', '71',
  '81', '82', '83', '84', '85',
];

export function normalizeFdiToothNumber(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length !== 2) return null;
  return digits;
}

export function isPermanentFdi(tooth: string): boolean {
  return PERMANENT_TEETH_FDI.includes(tooth);
}

export function isDeciduousFdi(tooth: string): boolean {
  return DECIDUOUS_TEETH_FDI.includes(tooth);
}

export function isValidFdiTooth(tooth: string): boolean {
  return isPermanentFdi(tooth) || isDeciduousFdi(tooth);
}

export function getToothType(tooth: string): DentalToothType | null {
  if (isPermanentFdi(tooth)) return 'permanent';
  if (isDeciduousFdi(tooth)) return 'deciduous';
  return null;
}

/** Converte permanente → decíduo (FDI). Retorna null se não houver correspondente. */
export function permanentToDeciduousFdi(tooth: string): string | null {
  const n = normalizeFdiToothNumber(tooth);
  if (!n) return null;
  return PERMANENT_TO_DECIDUOUS[n] ?? null;
}

/** Converte decíduo → permanente (FDI). */
export function deciduousToPermanentFdi(tooth: string): string | null {
  const n = normalizeFdiToothNumber(tooth);
  if (!n) return null;
  return DECIDUOUS_TO_PERMANENT[n] ?? null;
}

/**
 * Ao marcar situação "decíduo", mapeia o número permanente para o FDI decíduo.
 * Se já for decíduo, mantém. Se não houver mapeamento (ex.: 18), retorna o original.
 */
export function resolveToothNumberForDeciduousCondition(tooth: string): string {
  const n = normalizeFdiToothNumber(tooth);
  if (!n) return String(tooth ?? '');
  if (isDeciduousFdi(n)) return n;
  return permanentToDeciduousFdi(n) ?? n;
}

/**
 * Ao marcar situação "permanente", mapeia decíduo → permanente quando possível.
 */
export function resolveToothNumberForPermanentCondition(tooth: string): string {
  const n = normalizeFdiToothNumber(tooth);
  if (!n) return String(tooth ?? '');
  if (isPermanentFdi(n)) return n;
  return deciduousToPermanentFdi(n) ?? n;
}

export function isUpperArchTooth(tooth: string): boolean {
  const n = normalizeFdiToothNumber(tooth);
  if (!n) return false;
  const q = Number(n[0]);
  return q === 1 || q === 2 || q === 5 || q === 6;
}

export function isLowerArchTooth(tooth: string): boolean {
  const n = normalizeFdiToothNumber(tooth);
  if (!n) return false;
  const q = Number(n[0]);
  return q === 3 || q === 4 || q === 7 || q === 8;
}

/** Faces típicas por tipo de dente (simplificado). Centro = Oclusal. */
export function facesForTooth(tooth: string): DentalToothFace[] {
  const n = normalizeFdiToothNumber(tooth);
  if (!n) return ['M', 'D', 'V', 'L', 'O'];
  const upper = isUpperArchTooth(n);
  return upper ? ['M', 'D', 'V', 'P', 'O'] : ['M', 'D', 'V', 'L', 'O'];
}

export const DENTAL_FACE_LABELS: Record<DentalToothFace, string> = {
  M: 'Mesial',
  D: 'Distal',
  V: 'Vestibular',
  L: 'Lingual',
  P: 'Palatina',
  O: 'Oclusal',
  I: 'Incisal',
};

export const DENTAL_REGION_LABELS: Record<DentalArchRegion, string> = {
  upper_arch: 'Arcada superior',
  lower_arch: 'Arcada inferior',
  both_arches: 'Ambas as arcadas',
};

/** Códigos de raiz usados no plano (simplificado por tipo de dente). */
export type DentalRootCode = 'R' | 'M' | 'D' | 'MB' | 'DB' | 'P' | 'B';

export const DENTAL_ROOT_LABELS: Record<DentalRootCode, string> = {
  R: 'Raiz única',
  M: 'Mesial',
  D: 'Distal',
  MB: 'Mésio-vestibular',
  DB: 'Disto-vestibular',
  P: 'Palatina',
  B: 'Vestibular',
};

/** Raízes típicas por posição FDI (simplificado clinicamente). */
export function rootsForTooth(tooth: string): DentalRootCode[] {
  const n = normalizeFdiToothNumber(tooth);
  if (!n) return ['R'];
  const pos = Number(n[1]);
  const upper = isUpperArchTooth(n);
  // Incisivos / caninos
  if (pos >= 1 && pos <= 3) return ['R'];
  // Pré-molares
  if (pos === 4 || pos === 5) {
    return upper ? ['B', 'P'] : ['R'];
  }
  // Molares
  if (pos >= 6 && pos <= 8) {
    return upper ? ['MB', 'DB', 'P'] : ['M', 'D'];
  }
  return ['R'];
}
