import {
  isDeciduousFdi,
  isPermanentFdi,
  isUpperArchTooth,
  normalizeFdiToothNumber,
} from '@/lib/dentalFdi';

const permanenteRaw = import.meta.glob('./permanentes/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const deciduoRaw = import.meta.glob('./deciduos/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function buildMap(modules: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [path, markup] of Object.entries(modules)) {
    const match = path.match(/(\d{2})\.svg$/);
    if (!match) continue;
    map[match[1]] = markup;
  }
  return map;
}

const PERMANENTE_RAW = buildMap(permanenteRaw);
const DECIDUO_RAW = buildMap(deciduoRaw);

export type ToothDentitionAttr = 'permanente' | 'deciduo';
export type ToothRowAttr = 'superior' | 'inferior';

export function getToothDentition(tooth: string): ToothDentitionAttr | null {
  const n = normalizeFdiToothNumber(tooth);
  if (!n) return null;
  if (isDeciduousFdi(n)) return 'deciduo';
  if (isPermanentFdi(n)) return 'permanente';
  return null;
}

export function getToothRow(tooth: string): ToothRowAttr | null {
  const n = normalizeFdiToothNumber(tooth);
  if (!n) return null;
  return isUpperArchTooth(n) ? 'superior' : 'inferior';
}

export function getToothSvgRaw(tooth: string): string | null {
  const n = normalizeFdiToothNumber(tooth);
  if (!n) return null;
  if (isDeciduousFdi(n)) return DECIDUO_RAW[n] ?? null;
  if (isPermanentFdi(n)) return PERMANENTE_RAW[n] ?? null;
  return PERMANENTE_RAW[n] ?? DECIDUO_RAW[n] ?? null;
}

export function hasToothAsset(tooth: string): boolean {
  return Boolean(getToothSvgRaw(tooth));
}

/** @deprecated Prefer getToothSvgRaw — mantido para compat de testes. */
export function getToothAssetUrl(tooth: string): string | null {
  // Sem URL estática quando usamos ?raw; sinaliza existência via path sintético.
  const n = normalizeFdiToothNumber(tooth);
  if (!n || !hasToothAsset(n)) return null;
  const folder = isDeciduousFdi(n) ? 'deciduos' : 'permanentes';
  return `${folder}/${n}.svg`;
}

/**
 * Prepara o SVG individual para inline no React:
 * - data-tooth-number / data-dentition / data-row no <svg>
 * - IDs únicos (evita colisão de title/desc)
 * - estado selected no .hit
 */
export function prepareToothSvgMarkup(
  raw: string,
  opts: {
    tooth: string;
    dentition: ToothDentitionAttr;
    row: ToothRowAttr;
    selected?: boolean;
  }
): string {
  if (typeof DOMParser === 'undefined') {
    return raw;
  }

  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return raw;

  const uid = `t${opts.tooth}`;
  svg.setAttribute('data-tooth-number', opts.tooth);
  svg.setAttribute('data-dentition', opts.dentition);
  svg.setAttribute('data-row', opts.row);
  svg.setAttribute('role', 'img');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('class', 'h-full w-auto max-w-full select-none');
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.display = 'block';

  // Uniciza ids internos (title/desc/clipPath etc.)
  const idMap = new Map<string, string>();
  svg.querySelectorAll('[id]').forEach((el) => {
    const oldId = el.getAttribute('id');
    if (!oldId) return;
    const next = `${uid}-${oldId}`;
    idMap.set(oldId, next);
    el.setAttribute('id', next);
  });
  svg.querySelectorAll('[aria-labelledby]').forEach((el) => {
    const ref = el.getAttribute('aria-labelledby');
    if (!ref) return;
    el.setAttribute(
      'aria-labelledby',
      ref
        .split(/\s+/)
        .map((part) => idMap.get(part) ?? part)
        .join(' ')
    );
  });
  svg.querySelectorAll('[href^="#"], [xlink\\:href^="#"]').forEach((el) => {
    for (const attr of ['href', 'xlink:href'] as const) {
      const v = el.getAttribute(attr);
      if (v?.startsWith('#')) {
        const key = v.slice(1);
        const mapped = idMap.get(key);
        if (mapped) el.setAttribute(attr, `#${mapped}`);
      }
    }
  });

  const hit = svg.querySelector('.hit, [data-tooth], rect[role="button"]');
  if (hit) {
    hit.setAttribute('data-tooth', opts.tooth);
    hit.setAttribute('data-tooth-number', opts.tooth);
    hit.setAttribute('data-dentition', opts.dentition);
    hit.setAttribute('data-row', opts.row);
    hit.setAttribute('tabindex', '-1');
    hit.classList.toggle('selected', Boolean(opts.selected));
    // Clique tratado no wrapper React — evita botão aninhado.
    hit.removeAttribute('role');
  }

  // Alinha o highlight interno do SVG ao token do app.
  svg.querySelectorAll('style').forEach((styleEl) => {
    const css = styleEl.textContent || '';
    styleEl.textContent = css.replace(/#25a7a0/gi, '#2fa7a0').replace(/#168b86/gi, '#248f89');
  });

  return svg.outerHTML;
}

/** Ordem FDI decídua (referência do produto). */
export const DECIDUOUS_FDI_LAYOUT = {
  superiorDireito: ['55', '54', '53', '52', '51'] as const,
  superiorEsquerdo: ['61', '62', '63', '64', '65'] as const,
  inferiorEsquerdo: ['71', '72', '73', '74', '75'] as const,
  inferiorDireito: ['81', '82', '83', '84', '85'] as const,
} as const;
