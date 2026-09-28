import {
  isDeciduousFdi,
  isPermanentFdi,
  isValidFdiTooth,
  normalizeFdiToothNumber,
  type DentalArchRegion,
  type DentalToothFace,
} from '@/lib/dentalFdi';
import { calcDentalLocationQuantity } from '@/lib/dentalPlanCalc';

export type DentalSelectionType = 'individual' | 'group' | 'region';

export type DentalSelectionLocation = {
  toothNumber?: string | null;
  face?: DentalToothFace | null;
  root?: string | null;
  region?: DentalArchRegion | null;
};

export type DentalToothFaceSelection = {
  toothNumber: string;
  faces: DentalToothFace[];
};

export type DentalToothRootSelection = {
  toothNumber: string;
  roots: string[];
};

export const PERMANENT_UPPER_ARCH = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
] as const;

export const PERMANENT_LOWER_ARCH = [
  '48', '47', '46', '45', '44', '43', '42', '41',
  '31', '32', '33', '34', '35', '36', '37', '38',
] as const;

export const PERMANENT_ALL_TEETH = [...PERMANENT_UPPER_ARCH, ...PERMANENT_LOWER_ARCH] as const;

export function parseToothNumbersInput(raw: string): string[] {
  const parts = raw
    .split(/[,;\s]+/)
    .map((p) => normalizeFdiToothNumber(p))
    .filter((p): p is string => !!p);
  return [...new Set(parts)];
}

export function validateToothNumbers(numbers: string[]): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const n of numbers) {
    if (isValidFdiTooth(n)) valid.push(n);
    else invalid.push(n);
  }
  return { valid: [...new Set(valid)], invalid: [...new Set(invalid)] };
}

export function classifyTeethByDentition(teeth: string[]): {
  permanente: string[];
  deciduo: string[];
  unknown: string[];
  mixed: boolean;
} {
  const permanente: string[] = [];
  const deciduo: string[] = [];
  const unknown: string[] = [];
  for (const raw of teeth) {
    const n = normalizeFdiToothNumber(raw);
    if (!n || !isValidFdiTooth(n)) {
      unknown.push(String(raw));
      continue;
    }
    if (isDeciduousFdi(n)) deciduo.push(n);
    else if (isPermanentFdi(n)) permanente.push(n);
    else unknown.push(n);
  }
  return {
    permanente: [...new Set(permanente)],
    deciduo: [...new Set(deciduo)],
    unknown: [...new Set(unknown)],
    mixed: permanente.length > 0 && deciduo.length > 0,
  };
}

export type ToothSelectMode = 'replace' | 'add' | 'toggle';

/**
 * Aplica seleção com dedupe, validação FDI e detecção de mistura permanente/decíduo.
 */
export function applyToothSelection(params: {
  current: string[];
  incoming: string[];
  mode: ToothSelectMode;
  allowMixedDentition?: boolean;
}): {
  next: string[];
  invalid: string[];
  needsMixedConfirm: boolean;
  permanente: string[];
  deciduo: string[];
} {
  const { valid, invalid } = validateToothNumbers(params.incoming);
  let proposed: string[];
  if (params.mode === 'replace') {
    proposed = valid;
  } else if (params.mode === 'add') {
    proposed = [...new Set([...params.current, ...valid])];
  } else {
    proposed = [...params.current];
    for (const t of valid) {
      proposed = proposed.includes(t) ? proposed.filter((x) => x !== t) : [...proposed, t];
    }
  }

  const classified = classifyTeethByDentition(proposed);
  const needsMixedConfirm = classified.mixed && !params.allowMixedDentition;

  return {
    next: needsMixedConfirm ? params.current : proposed,
    invalid,
    needsMixedConfirm,
    permanente: classified.permanente,
    deciduo: classified.deciduo,
  };
}

export function formatTeethSelectionInput(teeth: string[]): string {
  return [
    ...new Set(
      teeth
        .map((t) => normalizeFdiToothNumber(t))
        .filter((t): t is string => !!t)
    ),
  ].join(', ');
}

export function toggleToothInSelection(selected: string[], tooth: string): string[] {
  const n = normalizeFdiToothNumber(tooth);
  if (!n || !isValidFdiTooth(n)) return selected;
  if (selected.includes(n)) return selected.filter((t) => t !== n);
  return [...selected, n];
}

export function toggleFaceInSelection(
  selected: DentalToothFaceSelection[],
  tooth: string,
  face: DentalToothFace
): DentalToothFaceSelection[] {
  const n = normalizeFdiToothNumber(tooth);
  if (!n || !isValidFdiTooth(n)) return selected;
  const existing = selected.find((s) => s.toothNumber === n);
  if (!existing) {
    return [...selected, { toothNumber: n, faces: [face] }];
  }
  const hasFace = existing.faces.includes(face);
  const faces = hasFace ? existing.faces.filter((f) => f !== face) : [...existing.faces, face];
  if (faces.length === 0) return selected.filter((s) => s.toothNumber !== n);
  return selected.map((s) => (s.toothNumber === n ? { ...s, faces } : s));
}

export function toggleRootInSelection(
  selected: DentalToothRootSelection[],
  tooth: string,
  root: string
): DentalToothRootSelection[] {
  const n = normalizeFdiToothNumber(tooth);
  if (!n || !isValidFdiTooth(n)) return selected;
  const existing = selected.find((s) => s.toothNumber === n);
  if (!existing) {
    return [...selected, { toothNumber: n, roots: [root] }];
  }
  const has = existing.roots.includes(root);
  const roots = has ? existing.roots.filter((r) => r !== root) : [...existing.roots, root];
  if (roots.length === 0) return selected.filter((s) => s.toothNumber !== n);
  return selected.map((s) => (s.toothNumber === n ? { ...s, roots } : s));
}

export function locationsFromTeethAndFaces(params: {
  teeth: string[];
  faceSelections?: DentalToothFaceSelection[];
  rootSelections?: DentalToothRootSelection[];
  region?: DentalArchRegion | null;
  selectionType: DentalSelectionType;
}): DentalSelectionLocation[] {
  if (params.selectionType === 'region' && params.region) {
    return [{ region: params.region }];
  }

  const faceMap = new Map(
    (params.faceSelections ?? []).map((s) => [s.toothNumber, s.faces] as const)
  );
  const rootMap = new Map(
    (params.rootSelections ?? []).map((s) => [s.toothNumber, s.roots] as const)
  );
  const locs: DentalSelectionLocation[] = [];

  for (const tooth of params.teeth) {
    const faces = faceMap.get(tooth) ?? [];
    const roots = rootMap.get(tooth) ?? [];

    if (faces.length === 0 && roots.length === 0) {
      locs.push({ toothNumber: tooth });
      continue;
    }

    if (faces.length > 0 && roots.length > 0) {
      for (const face of faces) {
        for (const root of roots) {
          locs.push({ toothNumber: tooth, face, root });
        }
      }
      continue;
    }

    if (faces.length > 0) {
      for (const face of faces) locs.push({ toothNumber: tooth, face });
      continue;
    }

    for (const root of roots) locs.push({ toothNumber: tooth, root });
  }
  return locs;
}

/** Individual: um item por localização. */
export function splitLocationsForIndividual(
  locations: DentalSelectionLocation[]
): DentalSelectionLocation[][] {
  if (locations.length === 0) return [[]];
  return locations.map((loc) => [loc]);
}

export function quantityFromSelection(locations: DentalSelectionLocation[]): number {
  return Math.max(1, calcDentalLocationQuantity(locations) || 1);
}

/** Detecta duplicidade exata procedimento + localizações (chave canônica). */
export function locationFingerprint(locations: DentalSelectionLocation[]): string {
  return locations
    .map((l) =>
      [l.region ?? '', l.toothNumber ?? '', l.face ?? '', l.root ?? ''].join(':')
    )
    .sort()
    .join('|');
}

export function isDuplicateDentalItem(params: {
  existing: Array<{ procedureName: string; locations: DentalSelectionLocation[] }>;
  procedureName: string;
  locations: DentalSelectionLocation[];
}): boolean {
  return findDuplicateDentalItem(params) != null;
}

/** Retorna o item existente com mesmo procedimento + localização canônica. */
export function findDuplicateDentalItem(params: {
  existing: Array<{ id?: string; procedureName: string; locations: DentalSelectionLocation[] }>;
  procedureName: string;
  locations: DentalSelectionLocation[];
}): {
  index: number;
  item: { id?: string; procedureName: string; locations: DentalSelectionLocation[] };
} | null {
  const name = params.procedureName.trim().toLowerCase();
  const fp = locationFingerprint(params.locations);
  const index = params.existing.findIndex(
    (item) =>
      item.procedureName.trim().toLowerCase() === name &&
      locationFingerprint(item.locations) === fp
  );
  if (index < 0) return null;
  return { index, item: params.existing[index]! };
}

/**
 * Conflito simplificado: mesmo procedimento + mesmo dente + mesma face
 * (ou região, ou dente inteiro sem face).
 */
export function hasProcedureToothFaceConflict(params: {
  existing: Array<{ id?: string; procedureName: string; locations: DentalSelectionLocation[] }>;
  procedureName: string;
  locations: DentalSelectionLocation[];
}): {
  id?: string;
  procedureName: string;
  locations: DentalSelectionLocation[];
} | null {
  const name = params.procedureName.trim().toLowerCase();
  const keys = new Set(
    params.locations.map((l) =>
      [l.region ?? '', l.toothNumber ?? '', l.face ?? ''].join(':')
    )
  );
  for (const item of params.existing) {
    if (item.procedureName.trim().toLowerCase() !== name) continue;
    for (const l of item.locations) {
      const key = [l.region ?? '', l.toothNumber ?? '', l.face ?? ''].join(':');
      if (keys.has(key)) return item;
    }
  }
  return null;
}
