import { cn } from '@/lib/utils';
import {
  DENTAL_FACE_LABELS,
  facesForTooth,
  normalizeFdiToothNumber,
  type DentalToothFace,
} from '@/lib/dentalFdi';

export type ToothFacePickerProps = {
  tooth: string;
  selectedFaces: DentalToothFace[];
  onToggleFace: (face: DentalToothFace) => void;
  disabled?: boolean;
  className?: string;
  /** sm = menu lateral; lg = painel ampliado. */
  size?: 'sm' | 'lg';
};

/**
 * Diagrama de faces no estilo clínico (cruz V / M · I|O · D / P|L).
 */
export function ToothFacePicker({
  tooth,
  selectedFaces,
  onToggleFace,
  disabled,
  className,
  size = 'lg',
}: ToothFacePickerProps) {
  const n = normalizeFdiToothNumber(tooth) ?? tooth;
  const available = facesForTooth(n);
  /** Centro do diagrama clínico = sempre Oclusal (O). */
  const center: DentalToothFace = 'O';
  const lingual: DentalToothFace = available.includes('P') ? 'P' : 'L';
  const active = (face: DentalToothFace) => selectedFaces.includes(face);
  const fill = (face: DentalToothFace) =>
    active(face) ? 'var(--odontograma-selected)' : '#f8fafc';
  const labelFill = (face: DentalToothFace) => (active(face) ? '#ffffff' : '#475569');
  const canToggle = (face: DentalToothFace) => {
    if (disabled) return false;
    if (face === 'O') return true;
    return available.includes(face);
  };

  const faceLabel =
    selectedFaces.length === 0
      ? 'Nenhuma'
      : selectedFaces.map((f) => DENTAL_FACE_LABELS[f]).join(', ');

  const boxClass = size === 'sm' ? 'h-[9.5rem] w-[9.5rem]' : 'h-[12rem] w-[12rem]';

  function toggle(face: DentalToothFace) {
    if (!canToggle(face)) return;
    onToggleFace(face);
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <svg
        viewBox="0 0 100 100"
        className={cn(boxClass, 'select-none')}
        role="img"
        aria-label={`Faces do dente ${n}${
          selectedFaces.length
            ? `: ${selectedFaces.map((f) => DENTAL_FACE_LABELS[f]).join(', ')}`
            : ''
        }`}
      >
        <rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx="10"
          fill="#eef2f6"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />

        {/* Vestibular */}
        <path
          d="M12 12 H88 L72 32 H28 Z"
          fill={fill('V')}
          stroke="#64748b"
          strokeWidth="1.2"
          className={cn(canToggle('V') && 'cursor-pointer')}
          onClick={() => toggle('V')}
        >
          <title>{DENTAL_FACE_LABELS.V}</title>
        </path>
        <text
          x="50"
          y="24"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={labelFill('V')}
          className="pointer-events-none"
        >
          V
        </text>

        {/* Mesial */}
        <path
          d="M12 12 V88 L32 72 V28 Z"
          fill={fill('M')}
          stroke="#64748b"
          strokeWidth="1.2"
          className={cn(canToggle('M') && 'cursor-pointer')}
          onClick={() => toggle('M')}
        >
          <title>{DENTAL_FACE_LABELS.M}</title>
        </path>
        <text
          x="20"
          y="53"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={labelFill('M')}
          className="pointer-events-none"
        >
          M
        </text>

        {/* Distal */}
        <path
          d="M88 12 V88 L68 72 V28 Z"
          fill={fill('D')}
          stroke="#64748b"
          strokeWidth="1.2"
          className={cn(canToggle('D') && 'cursor-pointer')}
          onClick={() => toggle('D')}
        >
          <title>{DENTAL_FACE_LABELS.D}</title>
        </path>
        <text
          x="80"
          y="53"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={labelFill('D')}
          className="pointer-events-none"
        >
          D
        </text>

        {/* Palatina / Lingual */}
        <path
          d="M12 88 H88 L72 68 H28 Z"
          fill={fill(lingual)}
          stroke="#64748b"
          strokeWidth="1.2"
          className={cn(canToggle(lingual) && 'cursor-pointer')}
          onClick={() => toggle(lingual)}
        >
          <title>{DENTAL_FACE_LABELS[lingual]}</title>
        </path>
        <text
          x="50"
          y="82"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={labelFill(lingual)}
          className="pointer-events-none"
        >
          {lingual}
        </text>

        {/* Oclusal */}
        <rect
          x="32"
          y="32"
          width="36"
          height="36"
          rx="3"
          fill={fill(center)}
          stroke="#64748b"
          strokeWidth="1.2"
          className={cn(canToggle(center) && 'cursor-pointer')}
          onClick={() => toggle(center)}
        >
          <title>{DENTAL_FACE_LABELS[center]}</title>
        </rect>
        <text
          x="50"
          y="54"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill={labelFill(center)}
          className="pointer-events-none"
        >
          O
        </text>
      </svg>

      <p className="text-center text-[11px] text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">Dente {n}</span>
        <span className="mx-1.5 text-border">·</span>
        <span className="font-medium text-[color:var(--odontograma-selected)]">{faceLabel}</span>
      </p>
    </div>
  );
}

/** Resumo textual das faces selecionadas (vários dentes). */
export function formatFaceSelectionSummary(
  faceSelections: Array<{ toothNumber: string; faces: DentalToothFace[] }>
): string | null {
  if (faceSelections.length === 0) return null;
  return faceSelections
    .map((s) => {
      const faces = s.faces.map((f) => DENTAL_FACE_LABELS[f]).join(', ');
      return `Dente ${s.toothNumber}: ${faces}`;
    })
    .join(' · ');
}
