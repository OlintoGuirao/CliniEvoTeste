import { useMemo, type MouseEvent, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import {
  getToothDentition,
  getToothRow,
  getToothSvgRaw,
  prepareToothSvgMarkup,
  type ToothDentitionAttr,
  type ToothRowAttr,
} from '@/components/dental/toothAssets';
import { isDeciduousFdi, normalizeFdiToothNumber } from '@/lib/dentalFdi';

export type ToothArch = 'upper' | 'lower';

/** Mantido para testes / compat — tipo visual por posição FDI. */
export type ToothKind = 'incisor' | 'lateral' | 'canine' | 'premolar' | 'molar' | 'wisdom';

export function toothKindFromFdi(tooth: string): ToothKind {
  const pos = Number(String(tooth).replace(/\D/g, '').slice(-1) || '1');
  if (pos === 1) return 'incisor';
  if (pos === 2) return 'lateral';
  if (pos === 3) return 'canine';
  if (pos === 4 || pos === 5) return 'premolar';
  if (pos === 8) return 'wisdom';
  return 'molar';
}

function archToRow(arch: ToothArch, tooth: string): ToothRowAttr {
  const fromTooth = getToothRow(tooth);
  if (fromTooth) return fromTooth;
  return arch === 'upper' ? 'superior' : 'inferior';
}

/**
 * Inline do SVG individual (permanentes/deciduos) com atributos de domínio
 * e camada de clique acessível — sem rasterizar o SVG.
 */
export function ToothAnatomySvg({
  tooth,
  arch,
  missingCrown,
  missingTooth,
  selected,
  onSelect,
  disabled,
  className,
}: {
  tooth: string;
  arch: ToothArch;
  missingCrown?: boolean;
  missingTooth?: boolean;
  selected?: boolean;
  onSelect?: (tooth: string, e: MouseEvent | PointerEvent) => void;
  disabled?: boolean;
  className?: string;
}) {
  const n = normalizeFdiToothNumber(tooth) ?? tooth;
  const dentition: ToothDentitionAttr =
    getToothDentition(n) ?? (isDeciduousFdi(n) ? 'deciduo' : 'permanente');
  const row = archToRow(arch, n);
  const raw = getToothSvgRaw(n);

  const markup = useMemo(() => {
    if (!raw) return null;
    return prepareToothSvgMarkup(raw, {
      tooth: n,
      dentition,
      row,
      selected,
    });
  }, [raw, n, dentition, row, selected]);

  if (missingTooth) {
    return (
      <div
        className={cn('flex h-[5.25rem] w-[2.85rem] items-center justify-center', className)}
        data-tooth-number={n}
        data-dentition={dentition}
        data-row={row}
        aria-hidden
      >
        <span className="text-sm text-slate-400">×</span>
      </div>
    );
  }

  if (!markup) {
    return (
      <div
        className={cn(
          'flex h-[5.25rem] w-[2.85rem] items-center justify-center text-[10px] text-slate-400',
          className
        )}
        data-tooth-number={n}
        data-dentition={dentition}
        data-row={row}
        aria-hidden
      >
        {n}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      title={selected ? `Dente ${n} selecionado` : `Dente ${n}`}
      aria-label={`Dente ${n} (${dentition}, ${row})`}
      aria-pressed={selected}
      data-tooth-number={n}
      data-dentition={dentition}
      data-row={row}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        onSelect?.(n, e);
      }}
      className={cn(
        'relative flex h-[5.25rem] w-[2.85rem] items-center justify-center overflow-hidden bg-transparent p-0',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--odontograma-selected)]',
        disabled && 'cursor-not-allowed opacity-60',
        selected &&
          'ring-2 ring-[color:var(--odontograma-selected)] ring-offset-1 bg-[color:var(--odontograma-selected-soft)]',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-full w-full [&_svg]:h-full [&_svg]:w-full',
          isDeciduousFdi(n) && 'max-h-[4.6rem]',
          missingCrown && 'opacity-45'
        )}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      {missingCrown ? (
        <span
          className="pointer-events-none absolute inset-x-1 bottom-0 h-[36%] bg-slate-300/65"
          aria-hidden
        />
      ) : null}
    </button>
  );
}
