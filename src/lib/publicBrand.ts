import { ACCENT_PRESETS } from '@/lib/theme-colors';

function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  const match6 = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(withHash);
  if (match6) return `#${match6[1]}${match6[2]}${match6[3]}`.toLowerCase();
  const match8 = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})[a-f\d]{2}$/i.exec(withHash);
  if (match8) return `#${match8[1]}${match8[2]}${match8[3]}`.toLowerCase();
  const match3 = /^#([a-f\d])([a-f\d])([a-f\d])$/i.exec(withHash);
  if (match3) return `#${match3[1]}${match3[1]}${match3[2]}${match3[2]}${match3[3]}${match3[3]}`.toLowerCase();
  return null;
}

function resolvePresetHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const id = value.trim().toLowerCase();
  const preset = ACCENT_PRESETS.find((p) => p.id === id);
  return preset?.hex ?? null;
}

/**
 * Resolve cor principal para páginas públicas sem depender de CSS vars do app.
 */
export function resolvePublicPrimary(params: {
  accentColor?: string | null;
  themePalette?: string | null;
  fallback?: string;
}): string {
  const paletteHex = normalizeHex(params.themePalette);
  if (paletteHex) return paletteHex;
  const palettePresetHex = resolvePresetHex(params.themePalette);
  if (palettePresetHex) return palettePresetHex;

  const accentHex = normalizeHex(params.accentColor);
  if (accentHex) return accentHex;
  const accentPresetHex = resolvePresetHex(params.accentColor);
  if (accentPresetHex) return accentPresetHex;

  return params.fallback ?? '#6A0DAD';
}

