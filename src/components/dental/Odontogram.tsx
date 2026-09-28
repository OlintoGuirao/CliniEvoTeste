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

/** Ordem clínica (visão do profissional): direita do paciente à esquerda da tela. */
const UPPER_TEETH = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
] as const;

const LOWER_TEETH = [
  '48', '47', '46', '45', '44', '43', '42', '41',
  '31', '32', '33', '34', '35', '36', '37', '38',
] as const;

const COL_W = 'w-[3.05rem] sm:w-[3.2rem]';
const GUM = 'bg-[#f2ddd4]';
const FACE_BAND = 'bg-[#e9eef2]';
const CROSS = 'bg-[color:var(--odontograma-selected)]';

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
  if (condition === 'deciduo') return permanentToDeciduousFdi(slot) ?? slot;
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
  const center: DentalToothFace = 'O';
  const lingual: DentalToothFace = faces.includes('P') ? 'P' : 'L';
  const active = (face: DentalToothFace) => selectedFaces.includes(face);
  const fill = (face: DentalToothFace) =>
    active(face) ? 'var(--odontograma-selected)' : '#ffffff';
  const labelFill = (face: DentalToothFace) => (active(face) ? '#ffffff' : '#64748b');

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
      <rect x="0.75" y="0.75" width="32.5" height="32.5" rx="4" fill="#fff" stroke="#9aa7b5" strokeWidth="1" />
      <path
        d="M5 5 H29 L25.5 11.5 H8.5 Z"
        fill={fill('V')}
        stroke="#9aa7b5"
        strokeWidth="0.8"
        className={cn(!disabled && onToggleFace && 'cursor-pointer')}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!disabled) onToggleFace?.('V');
        }}
      >
        <title>{`${tooth} — ${DENTAL_FACE_LABELS.V}`}</title>
      </path>
      <text
        x="17"
        y="9.2"
        textAnchor="middle"
        fontSize="4.2"
        fontWeight="700"
        fill={labelFill('V')}
        className="pointer-events-none select-none"
      >
        V
      </text>
      <path
        d="M5 5 V29 L11.5 25.5 V8.5 Z"
        fill={fill('M')}
        stroke="#9aa7b5"
        strokeWidth="0.8"
        className={cn(!disabled && onToggleFace && 'cursor-pointer')}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!disabled) onToggleFace?.('M');
        }}
      >
        <title>{`${tooth} — ${DENTAL_FACE_LABELS.M}`}</title>
      </path>
      <text
        x="8.2"
        y="18.5"
        textAnchor="middle"
        fontSize="4.2"
        fontWeight="700"
        fill={labelFill('M')}
        className="pointer-events-none select-none"
      >
        M
      </text>
      <path
        d="M29 5 V29 L22.5 25.5 V8.5 Z"
        fill={fill('D')}
        stroke="#9aa7b5"
        strokeWidth="0.8"
        className={cn(!disabled && onToggleFace && 'cursor-pointer')}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!disabled) onToggleFace?.('D');
        }}
      >
        <title>{`${tooth} — ${DENTAL_FACE_LABELS.D}`}</title>
      </path>
      <text
        x="25.8"
        y="18.5"
        textAnchor="middle"
        fontSize="4.2"
        fontWeight="700"
        fill={labelFill('D')}
        className="pointer-events-none select-none"
      >
        D
      </text>
      <path
        d="M5 29 H29 L25.5 22.5 H8.5 Z"
        fill={fill(lingual)}
        stroke="#9aa7b5"
        strokeWidth="0.8"
        className={cn(!disabled && onToggleFace && 'cursor-pointer')}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!disabled) onToggleFace?.(lingual);
        }}
      >
        <title>{`${tooth} — ${DENTAL_FACE_LABELS[lingual]}`}</title>
      </path>
      <text
        x="17"
        y="27.2"
        textAnchor="middle"
        fontSize="4.2"
        fontWeight="700"
        fill={labelFill(lingual)}
        className="pointer-events-none select-none"
      >
        {lingual}
      </text>
      <rect
        x="11.5"
        y="11.5"
        width="11"
        height="11"
        rx="1.2"
        fill={active(center) || (toothSelected && selectedFaces.length === 0) ? 'var(--odontograma-selected)' : '#ffffff'}
        stroke="#9aa7b5"
        strokeWidth="0.8"
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
      <text
        x="17"
        y="19"
        textAnchor="middle"
        fontSize="4.5"
        fontWeight="700"
        fill={
          active(center) || (toothSelected && selectedFaces.length === 0)
            ? '#ffffff'
            : '#64748b'
        }
        className="pointer-events-none select-none"
      >
        O
      </text>
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
        'relative shrink-0 border-r border-slate-300/70 transition-colors',
        isMidlineLeft && 'border-r-transparent',
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

  return (
    <div className={cn('w-full', className)}>
      <div
        className="w-full overflow-x-auto overscroll-x-contain rounded-sm border border-slate-200 bg-[#f6f7f9] [-webkit-overflow-scrolling:touch] select-none"
        onPointerLeave={() => {
          dragRef.current.active = false;
        }}
      >
        <div
          className="relative mx-auto"
          style={{ width: 'max(100%, 52rem)', minWidth: '52rem' }}
        >
          {/* Cruz vertical central */}
          <div
            className={cn(
              'pointer-events-none absolute inset-y-0 left-1/2 z-30 w-[1.5px] -translate-x-1/2',
              CROSS
            )}
            aria-hidden
          />

          {/* ===== Arcada superior ===== */}
          <div className={cn('flex', GUM)}>
            {upper.map((meta, i) => (
              <ColShell
                key={`ua-${meta.slot}`}
                slot={meta.slot}
                displayTooth={meta.display}
                hover={hoverSlot === meta.slot}
                selected={meta.selected}
                isMidlineLeft={i === 7}
                onHover={setHoverSlot}
                {...colHandlers(meta)}
              >
                <div className="flex h-[5.6rem] items-end justify-center pb-0.5 pt-1">
                  <ToothAnatomySvg
                    tooth={meta.display}
                    arch="upper"
                    missingTooth={meta.condition === 'ausente'}
                    missingCrown={meta.condition === 'ausencia_coroa'}
                    selected={meta.selected}
                    disabled={disabled}
                    onSelect={(t, e) => handleToothPointerDown(t, e)}
                    className={meta.condition === 'deciduo' ? 'scale-[0.9]' : undefined}
                  />
                </div>
              </ColShell>
            ))}
          </div>

          <div className="flex border-y border-slate-200/80 bg-white">
            {upper.map((meta, i) => (
              <ColShell
                key={`un-${meta.slot}`}
                slot={meta.slot}
                displayTooth={meta.display}
                hover={hoverSlot === meta.slot}
                selected={meta.selected}
                isMidlineLeft={i === 7}
                onHover={setHoverSlot}
                {...colHandlers(meta)}
              >
                <div className="flex h-6 items-center justify-center">
                  <span
                    title={
                      meta.condition
                        ? `${meta.display} — ${DENTAL_TOOTH_CONDITION_LABELS[meta.condition]}`
                        : `Dente ${meta.display}`
                    }
                    aria-pressed={meta.selected}
                    className={cn(
                      'min-w-[1.4rem] rounded px-0.5 text-center text-[11px] font-medium tabular-nums',
                      meta.selected
                        ? 'bg-[color:var(--odontograma-selected)] text-white'
                        : 'text-slate-600',
                      (meta.condition === 'ausente' || meta.condition === 'ausencia_coroa') &&
                        'line-through opacity-50'
                    )}
                  >
                    {meta.display}
                  </span>
                </div>
              </ColShell>
            ))}
          </div>

          <div className={cn('flex', FACE_BAND)}>
            {upper.map((meta, i) => (
              <ColShell
                key={`uf-${meta.slot}`}
                slot={meta.slot}
                displayTooth={meta.display}
                hover={hoverSlot === meta.slot}
                selected={meta.selected}
                isMidlineLeft={i === 7}
                onHover={setHoverSlot}
                {...colHandlers(meta)}
              >
                <div className="flex h-11 items-center justify-center">
                  <FaceDiagram
                    tooth={meta.display}
                    selectedFaces={meta.faces}
                    toothSelected={meta.selected}
                    disabled={disabled}
                    onSelectTooth={(e) => handleToothPointerDown(meta.display, e)}
                    onToggleFace={
                      onToggleFace
                        ? (face) => onToggleFace(meta.display, face)
                        : undefined
                    }
                  />
                </div>
              </ColShell>
            ))}
          </div>

          <div className={cn('relative z-30 h-[1.5px] w-full', CROSS)} aria-hidden />

          {/* ===== Arcada inferior ===== */}
          <div className={cn('flex', FACE_BAND)}>
            {lower.map((meta, i) => (
              <ColShell
                key={`lf-${meta.slot}`}
                slot={meta.slot}
                displayTooth={meta.display}
                hover={hoverSlot === meta.slot}
                selected={meta.selected}
                isMidlineLeft={i === 7}
                onHover={setHoverSlot}
                {...colHandlers(meta)}
              >
                <div className="flex h-11 items-center justify-center">
                  <FaceDiagram
                    tooth={meta.display}
                    selectedFaces={meta.faces}
                    toothSelected={meta.selected}
                    disabled={disabled}
                    onSelectTooth={(e) => handleToothPointerDown(meta.display, e)}
                    onToggleFace={
                      onToggleFace
                        ? (face) => onToggleFace(meta.display, face)
                        : undefined
                    }
                  />
                </div>
              </ColShell>
            ))}
          </div>

          <div className="flex border-y border-slate-200/80 bg-white">
            {lower.map((meta, i) => (
              <ColShell
                key={`ln-${meta.slot}`}
                slot={meta.slot}
                displayTooth={meta.display}
                hover={hoverSlot === meta.slot}
                selected={meta.selected}
                isMidlineLeft={i === 7}
                onHover={setHoverSlot}
                {...colHandlers(meta)}
              >
                <div className="flex h-6 items-center justify-center">
                  <span
                    title={
                      meta.condition
                        ? `${meta.display} — ${DENTAL_TOOTH_CONDITION_LABELS[meta.condition]}`
                        : `Dente ${meta.display}`
                    }
                    aria-pressed={meta.selected}
                    className={cn(
                      'min-w-[1.4rem] rounded px-0.5 text-center text-[11px] font-medium tabular-nums',
                      meta.selected
                        ? 'bg-[color:var(--odontograma-selected)] text-white'
                        : 'text-slate-600',
                      (meta.condition === 'ausente' || meta.condition === 'ausencia_coroa') &&
                        'line-through opacity-50'
                    )}
                  >
                    {meta.display}
                  </span>
                </div>
              </ColShell>
            ))}
          </div>

          <div className={cn('flex', GUM)}>
            {lower.map((meta, i) => (
              <ColShell
                key={`la-${meta.slot}`}
                slot={meta.slot}
                displayTooth={meta.display}
                hover={hoverSlot === meta.slot}
                selected={meta.selected}
                isMidlineLeft={i === 7}
                onHover={setHoverSlot}
                {...colHandlers(meta)}
              >
                <div className="flex h-[5.6rem] items-start justify-center pb-1 pt-0.5">
                  <ToothAnatomySvg
                    tooth={meta.display}
                    arch="lower"
                    missingTooth={meta.condition === 'ausente'}
                    missingCrown={meta.condition === 'ausencia_coroa'}
                    selected={meta.selected}
                    disabled={disabled}
                    onSelect={(t, e) => handleToothPointerDown(t, e)}
                    className={meta.condition === 'deciduo' ? 'scale-[0.9]' : undefined}
                  />
                </div>
              </ColShell>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
