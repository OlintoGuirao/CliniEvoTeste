/**
 * Dois modos:
 * 1. Cor de destaque (accent_color) = só botões, links, sidebar (primary/accent). Fundo e cards = tema claro/escuro.
 * 2. Tema de cor (theme_palette) = tema inteiro naquela cor (como Claro/Escuro). Ex.: Azul, Rosa.
 */

export type AccentPresetId = 'default' | 'teal' | 'blue' | 'rose' | 'violet' | 'emerald' | 'amber';

export interface AccentPreset {
  id: AccentPresetId;
  name: string;
  hex: string;
  light: string;
  dark: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'default', name: 'Padrão', hex: '#2d8a7a', light: '173 58% 39%', dark: '173 58% 45%' },
  { id: 'teal', name: 'Teal', hex: '#0d9488', light: '174 61% 38%', dark: '174 61% 44%' },
  { id: 'blue', name: 'Azul', hex: '#2563eb', light: '221 83% 53%', dark: '221 83% 58%' },
  { id: 'rose', name: 'Rosa', hex: '#e11d48', light: '346 77% 50%', dark: '346 77% 55%' },
  { id: 'violet', name: 'Violeta', hex: '#7c3aed', light: '262 83% 58%', dark: '262 83% 63%' },
  { id: 'emerald', name: 'Esmeralda', hex: '#059669', light: '160 84% 39%', dark: '160 84% 45%' },
  { id: 'amber', name: 'Âmbar', hex: '#d97706', light: '32 95% 44%', dark: '32 95% 50%' },
];

export type ThemePaletteId = AccentPresetId;

const PRIMARY_FG_LIGHT = '0 0% 100%';
const PRIMARY_FG_DARK = '220 25% 8%';

const ALL_VAR_KEYS = [
  '--background', '--foreground', '--card', '--card-foreground',
  '--popover', '--popover-foreground', '--primary', '--primary-foreground',
  '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
  '--accent', '--accent-foreground', '--border', '--input', '--ring',
  '--sidebar-background', '--sidebar-foreground', '--sidebar-primary',
  '--sidebar-primary-foreground', '--sidebar-accent', '--sidebar-accent-foreground',
  '--sidebar-border', '--sidebar-ring',
] as const;

const ACCENT_ONLY_KEYS = [
  '--primary', '--primary-foreground', '--secondary', '--secondary-foreground',
  '--accent', '--accent-foreground', '--ring',
  '--sidebar-primary', '--sidebar-primary-foreground', '--sidebar-accent',
  '--sidebar-accent-foreground', '--sidebar-ring',
] as const;

/**
 * Normaliza qualquer formato de hex para #rrggbb (6 dígitos).
 * Aceita: #RGB, #RRGGBB, #RRGGBBAA, rrggbb.
 */
function normalizeHex(hex: string): string | null {
  const trimmed = String(hex).trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const match6 = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(withHash);
  if (match6) return `#${match6[1].toLowerCase()}${match6[2].toLowerCase()}${match6[3].toLowerCase()}`;
  const match8 = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})[a-f\d]{2}$/i.exec(withHash);
  if (match8) return `#${match8[1].toLowerCase()}${match8[2].toLowerCase()}${match8[3].toLowerCase()}`;
  const match3 = /^#([a-f\d])([a-f\d])([a-f\d])$/i.exec(withHash);
  if (match3) {
    const r = match3[1] + match3[1];
    const g = match3[2] + match3[2];
    const b = match3[3] + match3[3];
    return `#${r}${g}${b}`.toLowerCase();
  }
  return null;
}

function hexToHsl(hex: string): string {
  const normalized = normalizeHex(hex);
  if (!normalized) return '173 58% 39%';
  const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/.exec(normalized);
  if (!result) return '173 58% 39%';
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lR = Math.round(l * 100);
  return `${h} ${s}% ${lR}%`;
}

function parseHsl(hsl: string): { h: number; s: number; l: number } {
  const match = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!match) return { h: 173, s: 58, l: 39 };
  return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
}

function contrastForeground(hsl: string): string {
  const { l } = parseHsl(hsl);
  return l < 50 ? PRIMARY_FG_LIGHT : PRIMARY_FG_DARK;
}

function getPrimaryFromValue(value: string, isDark: boolean): string {
  const preset = ACCENT_PRESETS.find((p) => p.id === value);
  if (preset) return isDark ? preset.dark : preset.light;
  const hex = normalizeHex(value);
  if (hex) {
    const light = hexToHsl(hex);
    const { h, s, l } = parseHsl(light);
    return isDark ? `${h} ${s}% ${Math.min(100, l + 6)}%` : light;
  }
  return '173 58% 39%';
}

/** Paleta completa (tema inteiro como Claro/Escuro). Usa h e s do primary para o fundo refletir a cor escolhida. */
function buildFullPalette(primary: string, isDark: boolean): Record<string, string> {
  const { h, s } = parseHsl(primary);
  const sTint = Math.min(65, Math.max(50, s)); // saturação do fundo: visível mas não forte (50–65%)
  if (isDark) {
    return {
      '--background': `${h} 30% 14%`,
      '--foreground': '0 0% 95%',
      '--card': `${h} 28% 17%`,
      '--card-foreground': '0 0% 95%',
      '--popover': `${h} 28% 17%`,
      '--popover-foreground': '0 0% 95%',
      '--primary': primary,
      '--primary-foreground': contrastForeground(primary),
      '--secondary': `${h} 25% 22%`,
      '--secondary-foreground': '0 0% 95%',
      '--muted': `${h} 25% 20%`,
      '--muted-foreground': '0 0% 65%',
      '--accent': `${h} 25% 24%`,
      '--accent-foreground': '0 0% 95%',
      '--border': `${h} 25% 22%`,
      '--input': `${h} 25% 22%`,
      '--ring': primary,
      '--sidebar-background': `${h} 30% 16%`,
      '--sidebar-foreground': '0 0% 95%',
      '--sidebar-primary': primary,
      '--sidebar-primary-foreground': contrastForeground(primary),
      '--sidebar-accent': `${h} 25% 22%`,
      '--sidebar-accent-foreground': '0 0% 95%',
      '--sidebar-border': `${h} 25% 22%`,
      '--sidebar-ring': primary,
    };
  }
  return {
    '--background': `${h} ${sTint}% 96%`,
    '--foreground': `${h} 35% 18%`,
    '--card': `${h} ${sTint}% 99%`,
    '--card-foreground': `${h} 35% 18%`,
    '--popover': `${h} ${sTint}% 99%`,
    '--popover-foreground': `${h} 35% 18%`,
    '--primary': primary,
    '--primary-foreground': contrastForeground(primary),
    '--secondary': `${h} ${sTint}% 90%`,
    '--secondary-foreground': `${h} 58% 25%`,
    '--muted': `${h} ${sTint}% 93%`,
    '--muted-foreground': `${h} 25% 40%`,
    '--accent': `${h} ${Math.min(70, sTint + 10)}% 88%`,
    '--accent-foreground': `${h} 58% 25%`,
    '--border': `${h} ${sTint}% 88%`,
    '--input': `${h} ${sTint}% 88%`,
    '--ring': primary,
    '--sidebar-background': `${h} ${sTint}% 97%`,
    '--sidebar-foreground': `${h} 35% 18%`,
    '--sidebar-primary': primary,
    '--sidebar-primary-foreground': contrastForeground(primary),
    '--sidebar-accent': `${h} ${sTint}% 90%`,
    '--sidebar-accent-foreground': `${h} 58% 25%`,
    '--sidebar-border': `${h} ${sTint}% 91%`,
    '--sidebar-ring': primary,
  };
}

/** Só primary/accent/ring/sidebar (cor de destaque); fundo e cards vêm do tema claro/escuro */
function buildAccentOnlyPalette(primary: string, isDark: boolean): Record<string, string> {
  const { h } = parseHsl(primary);
  return {
    '--primary': primary,
    '--primary-foreground': contrastForeground(primary),
    '--secondary': isDark ? `${h} 20% 15%` : `${h} 30% 95%`,
    '--secondary-foreground': isDark ? '0 0% 95%' : `${h} 58% 25%`,
    '--accent': isDark ? `${h} 20% 18%` : `${h} 40% 90%`,
    '--accent-foreground': isDark ? '0 0% 95%' : `${h} 58% 25%`,
    '--ring': primary,
    '--sidebar-primary': primary,
    '--sidebar-primary-foreground': contrastForeground(primary),
    '--sidebar-accent': isDark ? `${h} 20% 15%` : `${h} 30% 95%`,
    '--sidebar-accent-foreground': isDark ? '0 0% 95%' : `${h} 58% 25%`,
    '--sidebar-ring': primary,
  };
}

function clearAll(root: HTMLElement) {
  ALL_VAR_KEYS.forEach((key) => root.style.removeProperty(key));
}

/**
 * Aplica o tema de cor inteiro (como Claro/Escuro): fundo, cards, primary, tudo.
 * theme_palette = 'default' → remove override. Outro valor = aplica paleta completa.
 */
export function applyThemePalette(
  themePalette: string | null | undefined,
  isDark: boolean
): void {
  const root = document.documentElement;
  if (!themePalette || themePalette === 'default') {
    clearAll(root);
    return;
  }
  const primary = getPrimaryFromValue(themePalette, isDark);
  const palette = buildFullPalette(primary, isDark);
  Object.entries(palette).forEach(([key, val]) => {
    root.style.setProperty(key, val, 'important');
  });
}

/**
 * Cor de destaque: só botões, links, sidebar. Fundo e cards = tema claro/escuro (CSS).
 * Use quando theme_palette for 'default'.
 */
export function applyAccentColor(
  value: string | null | undefined,
  isDark?: boolean
): void {
  const root = document.documentElement;
  const resolvedDark = isDark ?? root.classList.contains('dark');

  if (!value || value === 'default') {
    ACCENT_ONLY_KEYS.forEach((key) => root.style.removeProperty(key));
    return;
  }
  const primary = getPrimaryFromValue(value, resolvedDark);
  const palette = buildAccentOnlyPalette(primary, resolvedDark);
  Object.entries(palette).forEach(([key, val]) => {
    root.style.setProperty(key, val, 'important');
  });
}

/** ID do tema estático Aura (AuraLight/AuraDark). Não altera temas Light/Dark existentes. */
export const AURA_THEME_ID = 'aura' as const;

/**
 * Entrada única: aplica tema de cor OU cor de destaque conforme perfil.
 * theme_palette 'aura' = tema estático Aura (data-theme). Outros = tema inteiro inline. default + accent_color = só destaque.
 */
export function applyThemeFromProfile(
  themePalette: string | null | undefined,
  accentColor: string | null | undefined,
  isDark: boolean
): void {
  const root = document.documentElement;
  clearAll(root);

  if (themePalette === AURA_THEME_ID) {
    root.dataset.theme = isDark ? 'aura-dark' : 'aura-light';
    return;
  }
  delete root.dataset.theme;

  if (themePalette && themePalette !== 'default') {
    // Preset ou cor personalizada: aplica paleta inteira conforme tema (claro ou escuro)
    applyThemePalette(themePalette, isDark);
    return;
  }
  if (accentColor) {
    applyAccentColor(accentColor, isDark);
  }
}

export function normalizeAccentValue(value: string | null | undefined): string | null {
  if (!value || value === 'default') return null;
  if (ACCENT_PRESETS.some((p) => p.id === value)) return value;
  const hex = normalizeHex(value);
  if (hex) return hex;
  return null;
}

/** Indica se o valor é uma cor personalizada (hex) para tema inteiro */
export function isThemePaletteCustomHex(value: string | null | undefined): boolean {
  return !!value && !!normalizeHex(value);
}

export function normalizeThemePaletteValue(value: string | null | undefined): string | null {
  if (!value || value === 'default') return null;
  if (value === AURA_THEME_ID) return value;
  if (ACCENT_PRESETS.some((p) => p.id === value)) return value;
  const hex = normalizeHex(value);
  if (hex) return hex;
  return null;
}
