import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  DENTAL_FACE_LABELS,
  DENTAL_TOOTH_CONDITION_LABELS,
  facesForTooth,
  permanentToDeciduousFdi,
  type DentalToothCondition,
  type DentalToothFace,
} from '@/lib/dentalFdi';
import { ToothAnatomySvg } from '@/components/dental/ToothAnatomySvg';
import { getMouthBackgroundUrl } from '@/components/dental/toothAssets';

/** Ordem clínica (visão do profissional): direita do paciente à esquerda da tela. */
const UPPER_TEETH = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
] as const;

const LOWER_TEETH = [
  '48', '47', '46', '45', '44', '43', '42', '41',
  '31', '32', '33', '34', '35', '36', '37', '38',
] as const;

/** Coluna cresce para preencher o quadro; no mobile não encolhe abaixo disso. */
const COL_W = 'min-w-[2.85rem] flex-1 basis-0';
/** Faces oclusais sobre a abertura (meio transparente da boca). */
const FACE_BAND = 'bg-white/95';
const NUM_BAND = 'bg-[#eceff2]';
const CROSS = 'bg-[color:var(--odontograma-selected)]';
/** Proporção do asset boca-*.png (ilhas do sorriso). */
const MOUTH_ASPECT = '950 / 420';

export type OdontogramToothInteractOptions = {
  /** Ctrl/Cmd ou arraste: adiciona/remove sem substituir. */
  additive: boolean;
  /** Arraste: só adiciona (não remove). */
  dragAdd?: boolean;
};

export type OdontogramProps = {
  selectedTeeth: string[];
  onSelectTooth: (tooth: string, opts: OdontogramToothInteractOptions) => void;
  faceSelections?: Array<{ toothNumber: string; faces: DentalToothFace[] }>;
  onToggleFace?: (tooth: string, face: DentalToothFace) => void;
  conditionsByTooth?: Record<string, DentalToothCondition>;
  disabled?: boolean;
  className?: string;
};

function conditionForSlot(
  slot: string,
  conditionsByTooth?: Record<string, DentalToothCondition>
): DentalToothCondition | undefined {
  if (!conditionsByTooth) return undefined;
  if (conditionsByTooth[slot]) return conditionsByTooth[slot];
  const dec = permanentToDeciduousFdi(slot);
  if (dec && conditionsByTooth[dec]) return conditionsByTooth[dec];
  return undefined;
}

function displayToothForSlot(
  slot: string,
  condition?: DentalToothCondition
): string {
  if (condition === 'deciduo') {
    return permanentToDeciduousFdi(slot) ?? slot;
  }
  return slot;
}

function FaceDiagram({
  tooth,
  selectedFaces,
  toothSelected,
  disabled,
  onToggleFace,
  onSelectTooth,
}: {
  tooth: string;
  selectedFaces: DentalToothFace[];
  toothSelected: boolean;
  disabled?: boolean;
  onToggleFace?: (face: DentalToothFace) => void;
  onSelectTooth: (e: MouseEvent | PointerEvent) => void;
}) {
  const faces = facesForTooth(tooth);
  const center: DentalToothFace = faces.includes('I') ? 'I' : 'O';
  const lingual: DentalToothFace = faces.includes('P') ? 'P' : 'L';
  const active = (face: DentalToothFace) => selectedFaces.includes(face);
  const fill = (face: DentalToothFace) =>
    active(face) ? 'var(--odontograma-selected)' : '#ffffff';
  const stroke = '#9aa7b5';

  return (
    <svg
      viewBox="0 0 34 34"
      className={cn(
        'h-[34px] w-[34px] transition-shadow',
        toothSelected && 'drop-shadow-[0_0_0_2px_var(--odontograma-selected)]'
      )}
      role="img"
      aria-label={`Faces do dente ${tooth}${
        selectedFaces.length
          ? `: ${selectedFaces.map((f) => DENTAL_FACE_LABELS[f]).join(', ')}`
          : ''
      }`}
    >
      {/* Diagrama clínico compacto (sem letras — estilo referência). */}
      <path
        d="M4 4 H30 L25 12 H9 Z"
        fill={fill('V')}
        stroke={stroke}
        strokeWidth="0.75"
        className={cn(!disabled && onToggleFace && 'cursor-pointer')}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!disabled) onToggleFace?.('V');
        }}
      >
        <title>{`${tooth} — ${DENTAL_FACE_LABELS.V}`}</title>
      </path>
      <path
        d="M4 4 V30 L12 25 V9 Z"
        fill={fill('M')}
        stroke={stroke}
        strokeWidth="0.75"
        className={cn(!disabled && onToggleFace && 'cursor-pointer')}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!disabled) onToggleFace?.('M');
        }}
      >
        <title>{`${tooth} — ${DENTAL_FACE_LABELS.M}`}</title>
      </path>
      <path
        d="M30 4 V30 L22 25 V9 Z"
        fill={fill('D')}
        stroke={stroke}
        strokeWidth="0.75"
        className={cn(!disabled && onToggleFace && 'cursor-pointer')}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!disabled) onToggleFace?.('D');
        }}
      >
        <title>{`${tooth} — ${DENTAL_FACE_LABELS.D}`}</title>
      </path>
      <path
        d="M4 30 H30 L25 22 H9 Z"
        fill={fill(lingual)}
        stroke={stroke}
        strokeWidth="0.75"
        className={cn(!disabled && onToggleFace && 'cursor-pointer')}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!disabled) onToggleFace?.(lingual);
        }}
      >
        <title>{`${tooth} — ${DENTAL_FACE_LABELS[lingual]}`}</title>
      </path>
      <rect
        x="11.5"
        y="11.5"
        width="11"
        height="11"
        rx="1"
        fill={
          active(center) || (toothSelected && selectedFaces.length === 0)
            ? 'var(--odontograma-selected)'
            : '#ffffff'
        }
        stroke={stroke}
        strokeWidth="0.75"
        className={cn(!disabled && 'cursor-pointer')}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (disabled) return;
          if (onToggleFace) onToggleFace(center);
          else onSelectTooth(e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!disabled) onSelectTooth(e);
        }}
      >
        <title>{`${tooth} — ${DENTAL_FACE_LABELS[center]}`}</title>
      </rect>
    </svg>
  );
}

type SlotMeta = {
  slot: string;
  display: string;
  condition?: DentalToothCondition;
  selected: boolean;
  faces: DentalToothFace[];
};

function buildSlotMetas(
  teeth: readonly string[],
  selectedSet: Set<string>,
  faceMap: Map<string, DentalToothFace[]>,
  conditionsByTooth?: Record<string, DentalToothCondition>
): SlotMeta[] {
  return teeth.map((slot) => {
    const condition = conditionForSlot(slot, conditionsByTooth);
    const display = displayToothForSlot(slot, condition);
    return {
      slot,
      display,
      condition,
      selected: selectedSet.has(display) || selectedSet.has(slot),
      faces: faceMap.get(display) ?? faceMap.get(slot) ?? [],
    };
  });
}

function ColShell({
  children,
  hover,
  selected,
  isMidlineLeft,
  onHover,
  slot,
  displayTooth,
  onPointerDownTooth,
  onPointerEnterTooth,
}: {
  children: ReactNode;
  hover: boolean;
  selected: boolean;
  isMidlineLeft?: boolean;
  onHover: (slot: string | null) => void;
  slot: string;
  displayTooth: string;
  onPointerDownTooth?: (e: PointerEvent) => void;
  onPointerEnterTooth?: () => void;
}) {
  return (
    <div
      title={
        selected
          ? `Dente ${displayTooth} selecionado`
          : `Dente ${displayTooth} — clique, Ctrl/Cmd+clique ou arraste`
      }
      className={cn(
        COL_W,
        'relative flex h-full min-h-0 flex-col border-r transition-colors last:border-r-0',
        isMidlineLeft
          ? 'border-r-2 border-r-[color:var(--odontograma-selected)]'
          : 'border-slate-300/70',
        hover && !selected && 'bg-slate-200/35',
        selected &&
          'z-[1] bg-[color:var(--odontograma-selected-soft)] shadow-[inset_0_0_0_2px_var(--odontograma-selected)]'
      )}
      onMouseEnter={() => onHover(slot)}
      onMouseLeave={() => onHover(null)}
      onPointerDown={onPointerDownTooth}
      onPointerEnter={onPointerEnterTooth}
    >
      {children}
    </div>
  );
}

function ToothImageCell({
  meta,
  arch,
  disabled,
}: {
  meta: SlotMeta;
  arch: 'upper' | 'lower';
  disabled?: boolean;
}) {
  const missing =
    meta.condition === 'ausente' ||
    (meta.condition === 'deciduo' && permanentToDeciduousFdi(meta.slot) == null);
  const missingCrown = meta.condition === 'ausencia_coroa';

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full justify-center',
        arch === 'upper' ? 'items-end pb-0.5 pt-1' : 'items-start pb-1 pt-0.5'
      )}
    >
      <button
        type="button"
        title={
          meta.selected
            ? `Dente ${meta.display} selecionado`
            : `Dente ${meta.display}`
        }
        aria-label={`Dente ${meta.display} (${
          meta.condition === 'deciduo' ? 'decíduo' : 'permanente'
        }, ${arch === 'upper' ? 'superior' : 'inferior'})`}
        aria-pressed={meta.selected}
        data-tooth-number={meta.display}
        data-dentition={meta.condition === 'deciduo' ? 'deciduo' : 'permanente'}
        data-row={arch === 'upper' ? 'superior' : 'inferior'}
        disabled={disabled}
        className={cn(
          'relative flex h-[88%] max-h-[5.75rem] w-[2.85rem] items-center justify-center overflow-visible p-0',
          'bg-transparent focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-[color:var(--odontograma-selected)]',
          meta.selected &&
            'ring-2 ring-[color:var(--odontograma-selected)] ring-offset-1 bg-[color:var(--odontograma-selected-soft)]',
          (missing || missingCrown) && 'opacity-70'
        )}
      >
        <span className="pointer-events-none block h-full w-full [&_svg]:h-full [&_svg]:w-full">
          <ToothAnatomySvg
            tooth={meta.display}
            permanentSlot={meta.slot}
            missingTooth={missing}
            selected={meta.selected}
            className={cn(
              meta.condition === 'deciduo' && 'scale-[0.92]',
              missingCrown && 'opacity-40'
            )}
          />
        </span>
      </button>
    </div>
  );
}

function ToothNumberCell({ meta }: { meta: SlotMeta }) {
  return (
    <div className="flex h-7 items-center justify-center">
      <span
        title={
          meta.condition
            ? `${meta.display} — ${DENTAL_TOOTH_CONDITION_LABELS[meta.condition]}`
            : `Dente ${meta.display}`
        }
        aria-pressed={meta.selected}
        className={cn(
          'text-center text-[11px] font-medium tabular-nums tracking-tight',
          meta.selected
            ? 'font-semibold text-[color:var(--odontograma-selected)]'
            : 'text-slate-500',
          (meta.condition === 'ausente' || meta.condition === 'ausencia_coroa') &&
            'line-through opacity-50'
        )}
      >
        {meta.display}
      </span>
    </div>
  );
}

export function Odontogram({
  selectedTeeth,
  onSelectTooth,
  faceSelections = [],
  onToggleFace,
  conditionsByTooth,
  disabled,
  className,
}: OdontogramProps) {
  const selectedSet = new Set(selectedTeeth);
  const faceMap = new Map(faceSelections.map((s) => [s.toothNumber, s.faces] as const));
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);
  const dragRef = useRef<{ active: boolean }>({ active: false });
  const mouthBg = getMouthBackgroundUrl();

  const upper = buildSlotMetas(UPPER_TEETH, selectedSet, faceMap, conditionsByTooth);
  const lower = buildSlotMetas(LOWER_TEETH, selectedSet, faceMap, conditionsByTooth);

  function handleToothPointerDown(tooth: string, e: PointerEvent | MouseEvent) {
    if (disabled) return;
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    dragRef.current.active = true;
    onSelectTooth(tooth, { additive, dragAdd: false });
  }

  function handleToothPointerEnter(tooth: string) {
    if (disabled || !dragRef.current.active) return;
    onSelectTooth(tooth, { additive: true, dragAdd: true });
  }

  useEffect(() => {
    const endDrag = () => {
      dragRef.current.active = false;
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, []);

  const colHandlers = (meta: SlotMeta) => ({
    onPointerDownTooth: (e: PointerEvent) => {
      handleToothPointerDown(meta.display, e);
    },
    onPointerEnterTooth: () => handleToothPointerEnter(meta.display),
  });

  const renderFaceRow = (metas: SlotMeta[], keyPrefix: string) => (
    <div className={cn('flex h-full min-h-0', FACE_BAND)}>
      {metas.map((meta, i) => (
        <ColShell
          key={`${keyPrefix}-${meta.slot}`}
          slot={meta.slot}
          displayTooth={meta.display}
          hover={hoverSlot === meta.slot}
          selected={meta.selected}
          isMidlineLeft={i === 7}
          onHover={setHoverSlot}
          {...colHandlers(meta)}
        >
          <div className="flex h-full items-center justify-center">
            <FaceDiagram
              tooth={meta.display}
              selectedFaces={meta.faces}
              toothSelected={meta.selected}
              disabled={disabled}
              onSelectTooth={(e) => handleToothPointerDown(meta.display, e)}
              onToggleFace={
                onToggleFace ? (face) => onToggleFace(meta.display, face) : undefined
              }
            />
          </div>
        </ColShell>
      ))}
    </div>
  );

  const renderNumberRow = (metas: SlotMeta[], keyPrefix: string) => (
    <div className={cn('flex border-y border-slate-300/60', NUM_BAND)}>
      {metas.map((meta, i) => (
        <ColShell
          key={`${keyPrefix}-${meta.slot}`}
          slot={meta.slot}
          displayTooth={meta.display}
          hover={hoverSlot === meta.slot}
          selected={meta.selected}
          isMidlineLeft={i === 7}
          onHover={setHoverSlot}
          {...colHandlers(meta)}
        >
          <ToothNumberCell meta={meta} />
        </ColShell>
      ))}
    </div>
  );

  const renderAnatomyRow = (
    metas: SlotMeta[],
    arch: 'upper' | 'lower',
    keyPrefix: string
  ) => (
    <div className="flex h-full min-h-0 bg-transparent">
      {metas.map((meta, i) => (
        <ColShell
          key={`${keyPrefix}-${meta.slot}`}
          slot={meta.slot}
          displayTooth={meta.display}
          hover={hoverSlot === meta.slot}
          selected={meta.selected}
          isMidlineLeft={i === 7}
          onHover={setHoverSlot}
          {...colHandlers(meta)}
        >
          <ToothImageCell meta={meta} arch={arch} disabled={disabled} />
        </ColShell>
      ))}
    </div>
  );

  return (
    <div className={cn('w-full min-w-0', className)}>
      <div
        className="w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-sm border border-slate-200 bg-white [-webkit-overflow-scrolling:touch] select-none"
        onPointerLeave={() => {
          dragRef.current.active = false;
        }}
      >
        <div className="w-full min-w-[45.6rem]">
          {/* Superior: números */}
          {renderNumberRow(upper, 'un')}

          {/* Ilhas do sorriso (boca-*.png): gengiva rosa irregular + abertura */}
          <div
            className="relative flex w-full flex-col"
            style={{
              aspectRatio: MOUTH_ASPECT,
              ...(mouthBg
                ? {
                    backgroundImage: `url(${mouthBg})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: '100% 100%',
                  }
                : { backgroundColor: '#f2ddd4' }),
            }}
          >
            {/* ~32%: raízes na gengiva superior (ilha) */}
            <div className="min-h-0 basis-[32%]">{renderAnatomyRow(upper, 'upper', 'ua')}</div>
            {/* Faces no miolo transparente */}
            <div className="min-h-0 basis-[17%]">{renderFaceRow(upper, 'uf')}</div>

            <div className={cn('relative z-30 h-[2px] w-full shrink-0', CROSS)} aria-hidden />

            <div className="min-h-0 basis-[17%]">{renderFaceRow(lower, 'lf')}</div>
            {/* ~32%: raízes na gengiva inferior (ilha) */}
            <div className="min-h-0 flex-1 basis-[32%]">
              {renderAnatomyRow(lower, 'lower', 'la')}
            </div>
          </div>

          {/* Inferior: números */}
          {renderNumberRow(lower, 'ln')}
        </div>
      </div>
    </div>
  );
}
