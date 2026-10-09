import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { normalizeFdiToothNumber } from '@/lib/dentalFdi';
import {
  getToothDentition,
  getToothImageUrl,
  getToothRow,
  getToothSvgRaw,
  prepareToothSvgMarkup,
  type ToothDentitionAttr,
  type ToothRowAttr,
} from './toothAssets';

export type ToothKind =
  | 'incisor'
  | 'lateral'
  | 'canine'
  | 'premolar'
  | 'molar'
  | 'wisdom'
  | 'unknown';

/** Classificação anatômica aproximada a partir do dígito FDI (unidade). */
export function toothKindFromFdi(tooth: string): ToothKind {
  const n = normalizeFdiToothNumber(tooth);
  if (!n || n.length < 2) return 'unknown';
  const unit = n[1];
  switch (unit) {
    case '1':
      return 'incisor';
    case '2':
      return 'lateral';
    case '3':
      return 'canine';
    case '4':
    case '5':
      return n[0] === '5' || n[0] === '6' || n[0] === '7' || n[0] === '8'
        ? 'molar'
        : 'premolar';
    case '6':
    case '7':
      return 'molar';
    case '8':
      return 'wisdom';
    default:
      return 'unknown';
  }
}

type ToothAnatomySvgProps = {
  tooth: string;
  selected?: boolean;
  className?: string;
  /** Slot permanente (ex.: 18) — usado para placeholder de ausente no chart pediátrico. */
  permanentSlot?: string;
  /** Exibe imagem “ausente” (molares sem decíduo). */
  missingTooth?: boolean;
  /** Força dentição quando o número FDI é permanente mas a condição é decíduo (raro). */
  forceDentition?: ToothDentitionAttr;
};

/**
 * Célula visual do odontograma: PNG de referência quando disponível;
 * fallback para SVG inline (ex.: dente 73 decíduo sem PNG).
 */
export function ToothAnatomySvg({
  tooth,
  selected = false,
  className,
  permanentSlot,
  missingTooth = false,
  forceDentition,
}: ToothAnatomySvgProps) {
  const dentition = forceDentition ?? getToothDentition(tooth);
  const row = getToothRow(tooth);

  const pngUrl = useMemo(
    () =>
      getToothImageUrl(tooth, {
        missingTooth,
        permanentSlot,
      }),
    [tooth, missingTooth, permanentSlot]
  );

  const markup = useMemo(() => {
    if (pngUrl || !dentition || !row) return null;
    const raw = getToothSvgRaw(tooth);
    if (!raw) return null;
    return prepareToothSvgMarkup(raw, {
      tooth,
      dentition,
      row,
      selected,
    });
  }, [tooth, dentition, row, selected, pngUrl]);

  if (!dentition || !row) {
    return (
      <span
        className={cn(
          'flex h-full w-full items-center justify-center text-[10px] text-slate-400',
          className
        )}
        data-tooth-number={tooth}
      >
        {tooth}
      </span>
    );
  }

  if (pngUrl) {
    return (
      <img
        src={pngUrl}
        alt={`Dente ${tooth} — ${dentition}`}
        title={`Dente ${tooth} — ${dentition}`}
        data-tooth-number={tooth}
        data-dentition={dentition}
        data-row={row}
        data-missing={missingTooth ? 'true' : undefined}
        className={cn('h-full w-auto max-w-full select-none object-contain', className)}
        draggable={false}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    );
  }

  if (!markup) {
    return (
      <span
        className={cn(
          'flex h-full w-full items-center justify-center text-[10px] text-slate-400',
          className
        )}
        data-tooth-number={tooth}
        data-dentition={dentition}
        data-row={row}
      >
        {tooth}
      </span>
    );
  }

  return (
    <span
      className={cn('block h-full w-full [&_svg]:h-full [&_svg]:w-full', className)}
      // eslint-disable-next-line react/no-danger -- SVG clínico local (asset versionado)
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export type { ToothDentitionAttr, ToothRowAttr };
