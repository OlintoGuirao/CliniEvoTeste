/** Perfis de equipe no salão (sem conselho clínico). */

export type SalonStaffRoleId =
  | 'cabeleireiro'
  | 'barbeiro'
  | 'manicure'
  | 'pedicure'
  | 'maquiagem'
  | 'esteticista'
  | 'recepcionista'
  | 'outro';

export const SALON_STAFF_ROLES: ReadonlyArray<{ id: SalonStaffRoleId; label: string }> = [
  { id: 'cabeleireiro', label: 'Cabeleireiro(a)' },
  { id: 'barbeiro', label: 'Barbeiro(a)' },
  { id: 'manicure', label: 'Manicure' },
  { id: 'pedicure', label: 'Pedicure' },
  { id: 'maquiagem', label: 'Maquiagem' },
  { id: 'esteticista', label: 'Esteticista' },
  { id: 'recepcionista', label: 'Recepcionista' },
  { id: 'outro', label: 'Outro' },
];

/** Cores sugeridas para etiqueta na agenda. */
export const SALON_LABEL_COLOR_PRESETS: ReadonlyArray<{ id: string; name: string; hex: string }> = [
  { id: 'blue', name: 'Azul', hex: '#2563eb' },
  { id: 'teal', name: 'Teal', hex: '#0d9488' },
  { id: 'rose', name: 'Rosa', hex: '#e11d48' },
  { id: 'violet', name: 'Violeta', hex: '#7c3aed' },
  { id: 'emerald', name: 'Verde', hex: '#059669' },
  { id: 'amber', name: 'Âmbar', hex: '#d97706' },
  { id: 'orange', name: 'Laranja', hex: '#ea580c' },
  { id: 'sky', name: 'Céu', hex: '#0284c7' },
  { id: 'fuchsia', name: 'Fúcsia', hex: '#c026d3' },
  { id: 'slate', name: 'Cinza', hex: '#475569' },
];

export const DEFAULT_SALON_LABEL_COLOR = SALON_LABEL_COLOR_PRESETS[0]!.hex;

export function normalizeAgendaLabelColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return null;
}

export function salonStaffRoleLabel(staffTitle: string | null | undefined): string {
  const id = staffTitle?.trim();
  if (!id) return 'Profissional';
  const known = SALON_STAFF_ROLES.find((r) => r.id === id);
  if (known) return known.label;
  return id;
}

/** Estilo inline para slot ocupado na agenda do salão. */
export function salonAgendaSlotStyle(
  hex: string | null | undefined
): { backgroundColor: string; borderColor: string } | undefined {
  const color = normalizeAgendaLabelColor(hex);
  if (!color) return undefined;
  return {
    backgroundColor: `${color}26`,
    borderColor: color,
  };
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeAgendaLabelColor(hex);
  if (!normalized) return null;
  const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/.exec(normalized);
  if (!m) return null;
  return {
    r: parseInt(m[1]!, 16),
    g: parseInt(m[2]!, 16),
    b: parseInt(m[3]!, 16),
  };
}

/** Escurece ou clareia cor hex (amount: -1…1, negativo = mais escuro). */
export function shadeSalonLabelHex(hex: string, amount: number): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return hex;
  const mix = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel + amount * 255)));
  const r = mix(rgb.r);
  const g = mix(rgb.g);
  const b = mix(rgb.b);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export type SalonRibbonPalette = {
  base: string;
  light: string;
  dark: string;
  fold: string;
  text: string;
};

/** Paleta para etiqueta tipo fita na agenda. */
export function salonRibbonPalette(hex: string | null | undefined): SalonRibbonPalette {
  const base = normalizeAgendaLabelColor(hex) ?? DEFAULT_SALON_LABEL_COLOR;
  const light = shadeSalonLabelHex(base, 0.22);
  const dark = shadeSalonLabelHex(base, -0.28);
  const fold = shadeSalonLabelHex(base, -0.42);
  const rgb = parseHexRgb(base);
  const luminance = rgb ? (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255 : 0.5;
  const text = luminance > 0.62 ? '#1e293b' : '#ffffff';
  return { base, light, dark, fold, text };
}
