import { useRef, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PhotoUploadField } from '@/components/PhotoUploadField';
import { cn } from '@/lib/utils';

export interface FacialPoint {
  id: string;
  x: number; // 0–100 percent
  y: number;
  label?: string;
}

/** Traço reto no mapa (percentuais 0–100), ex.: vetor de aplicação ou marcação. */
export interface FacialStroke {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface BotoxFacialMapProps {
  points: FacialPoint[];
  onChange: (points: FacialPoint[]) => void;
  readOnly?: boolean;
  className?: string;
  /** URL da imagem de rosto (frontal). Se não informado, usa /face-map.png */
  imageSrc?: string;
  /** Largura do viewBox SVG (coordenadas dos pontos). Padrão 520. */
  viewBoxWidth?: number;
  /** Altura do viewBox SVG. Padrão 624. */
  viewBoxHeight?: number;
  /** Largura de exibição em px (ex.: 180). Se não informado, usa tamanho padrão 520. */
  displaySize?: number;
  /** Legenda abaixo do mapa. Se não informado, usa texto padrão. */
  caption?: string;
  /** Foto "Antes" exibida acima do mapa (opcional). */
  antesPhotoUrl?: string | null;
  onAntesPhotoChange?: (url: string | null) => void;
  antesUserId?: string;
  antesInstanceIdOrTemp?: string;
  antesDisabled?: boolean;
  /** Se false, não carrega o preview da foto (reduz RAM com vários procedimentos). */
  antesPreviewVisible?: boolean;
  /** Chamado antes de abrir a câmera (ex.: persistir rascunho e esconder prévias). */
  onCameraOpen?: () => void;
  /** Chamado quando a câmera fecha (restaurar prévias). */
  onCameraClose?: () => void;
  /** Traços no mapa (opcional). Requer `onStrokesChange` para editar. */
  strokes?: FacialStroke[];
  onStrokesChange?: (strokes: FacialStroke[]) => void;
}

/** Rosto frontal (imagem) com área clicável para marcar pontos de aplicação (Botox). */
const FACE_WIDTH = 520;
const FACE_HEIGHT = 624;
const DEFAULT_FACE_IMAGE = '/face-map.png';

const DEFAULT_CAPTION = 'Mapa facial — use Pontos ou Riscos conforme o modo selecionado';

const STROKE_MIN_LEN_PCT = 0.6;

export function BotoxFacialMap({
  points,
  onChange,
  readOnly,
  className,
  imageSrc,
  viewBoxWidth,
  viewBoxHeight,
  displaySize,
  caption,
  antesPhotoUrl,
  onAntesPhotoChange,
  antesUserId = '',
  antesInstanceIdOrTemp = 'botox-antes',
  antesDisabled,
  antesPreviewVisible = true,
  onCameraOpen,
  onCameraClose,
  strokes: strokesProp,
  onStrokesChange,
}: BotoxFacialMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const suppressSvgClickRef = useRef(false);
  const drawingRef = useRef(false);
  const draftStrokeRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'points' | 'strokes'>('points');
  const [draftStroke, setDraftStroke] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const strokes = strokesProp ?? [];
  const strokesEnabled = Boolean(onStrokesChange) && !readOnly;

  const faceImage = imageSrc ?? DEFAULT_FACE_IMAGE;
  const vbW = viewBoxWidth ?? FACE_WIDTH;
  const vbH = viewBoxHeight ?? FACE_HEIGHT;
  const w = displaySize ?? vbW;
  const h = displaySize != null ? Math.round((vbH / vbW) * displaySize) : vbH;

  const getRelativeCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 50, y: 50 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }, []);

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (readOnly) return;
      if (strokesEnabled && mapMode === 'strokes') return;
      if (suppressSvgClickRef.current) return;
      if ((e.target as SVGElement).closest('circle[data-point]')) return;
      const { x, y } = getRelativeCoords(e.clientX, e.clientY);
      const id = `pt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      onChange([...points, { id, x, y }]);
    },
    [readOnly, strokesEnabled, mapMode, points, onChange, getRelativeCoords]
  );

  const removePoint = useCallback(
    (id: string) => {
      onChange(points.filter((p) => p.id !== id));
      setSelectedId(null);
    },
    [points, onChange]
  );

  const removeStroke = useCallback(
    (id: string) => {
      if (!onStrokesChange) return;
      onStrokesChange(strokes.filter((s) => s.id !== id));
      setSelectedStrokeId(null);
    },
    [strokes, onStrokesChange]
  );

  const commitDraftStroke = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      if (!onStrokesChange) return;
      const dx = x2 - x1;
      const dy = y2 - y1;
      if (Math.hypot(dx, dy) < STROKE_MIN_LEN_PCT) return;
      suppressSvgClickRef.current = true;
      window.setTimeout(() => {
        suppressSvgClickRef.current = false;
      }, 0);
      const id = `ln-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      onStrokesChange([...strokes, { id, x1, y1, x2, y2 }]);
    },
    [strokes, onStrokesChange]
  );

  const handleStrokePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (readOnly || !onStrokesChange || mapMode !== 'strokes') return;
      if ((e.target as SVGElement).closest('circle[data-point]')) return;
      if ((e.target as SVGElement).closest('[data-stroke-hit]')) return;
      e.preventDefault();
      drawingRef.current = true;
      const { x, y } = getRelativeCoords(e.clientX, e.clientY);
      const start = { x1: x, y1: y, x2: x, y2: y };
      draftStrokeRef.current = start;
      setDraftStroke(start);
      setSelectedStrokeId(null);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [readOnly, onStrokesChange, mapMode, getRelativeCoords]
  );

  const handleStrokePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!drawingRef.current || !draftStrokeRef.current) return;
      const { x, y } = getRelativeCoords(e.clientX, e.clientY);
      const next = { ...draftStrokeRef.current, x2: x, y2: y };
      draftStrokeRef.current = next;
      setDraftStroke(next);
    },
    [getRelativeCoords]
  );

  const handleStrokePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const d = draftStrokeRef.current;
      draftStrokeRef.current = null;
      setDraftStroke(null);
      if (d) {
        commitDraftStroke(d.x1, d.y1, d.x2, d.y2);
      }
    },
    [commitDraftStroke]
  );

  const toSvg = (p: FacialPoint) => ({
    cx: (p.x / 100) * vbW,
    cy: (p.y / 100) * vbH,
  });

  const strokeToSvg = (s: FacialStroke) => ({
    x1: (s.x1 / 100) * vbW,
    y1: (s.y1 / 100) * vbH,
    x2: (s.x2 / 100) * vbW,
    y2: (s.y2 / 100) * vbH,
  });

  const showStrokeLayer = (strokes.length > 0 || draftStroke != null) || (!readOnly && onStrokesChange);

  return (
    <div className={className}>
      {onAntesPhotoChange != null && (
        <div className="mb-4 md:max-w-[200px] md:mx-auto">
          <PhotoUploadField
            label="Foto antes da sessão"
            value={antesPhotoUrl ?? null}
            onChange={onAntesPhotoChange}
            userId={antesUserId}
            instanceIdOrTemp={antesInstanceIdOrTemp}
            disabled={antesDisabled}
            compact
            previewVisible={antesPreviewVisible}
            onCameraOpen={onCameraOpen}
            onCameraClose={onCameraClose}
          />
        </div>
      )}
      <div className="flex flex-col items-center">
        {onStrokesChange && !readOnly && (
          <div
            className="mb-3 flex w-full max-w-[520px] gap-1 rounded-xl border border-border bg-muted/40 p-1"
            role="tablist"
            aria-label="Modo do mapa"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mapMode === 'points'}
              className={cn(
                'flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors',
                mapMode === 'points'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => {
                setMapMode('points');
                setSelectedStrokeId(null);
                setDraftStroke(null);
              }}
            >
              Pontos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mapMode === 'strokes'}
              className={cn(
                'flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors',
                mapMode === 'strokes'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => {
                setMapMode('strokes');
                setSelectedId(null);
                setDraftStroke(null);
              }}
            >
              Riscos
            </button>
          </div>
        )}
        <div
          className="relative inline-block rounded-lg border border-input bg-muted/20 p-2 w-full max-w-[520px]"
          style={displaySize != null ? { width: displaySize, maxWidth: displaySize } : undefined}
        >
          <svg
            ref={svgRef}
            width={w}
            height={h}
            viewBox={`0 0 ${vbW} ${vbH}`}
            className={cn(
              'block w-full h-auto touch-none',
              mapMode === 'strokes' && strokesEnabled ? 'cursor-cell' : 'cursor-crosshair'
            )}
            onClick={handleSvgClick}
            onPointerDown={handleStrokePointerDown}
            onPointerMove={handleStrokePointerMove}
            onPointerUp={handleStrokePointerUp}
            onPointerCancel={handleStrokePointerUp}
          >
            {/* Fundo claro (fallback quando a imagem não carrega) */}
            <rect x={0} y={0} width={vbW} height={vbH} fill="hsl(var(--muted))" />
            {/* Imagem de rosto frontal */}
            <image
              href={faceImage}
              x={0}
              y={0}
              width={vbW}
              height={vbH}
              preserveAspectRatio="xMidYMid meet"
              style={{ pointerEvents: 'none' }}
            />
            {/* Traços (abaixo dos pontos) */}
            {showStrokeLayer && (
              <g style={{ pointerEvents: readOnly ? 'none' : undefined }}>
                {strokes.map((s) => {
                  const { x1, y1, x2, y2 } = strokeToSvg(s);
                  const sel = selectedStrokeId === s.id;
                  return (
                    <g key={s.id}>
                      {/* Área larga para toque/clique */}
                      <line
                        data-stroke-hit
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="transparent"
                        strokeWidth={readOnly ? 0 : 20}
                        strokeLinecap="round"
                        className={readOnly ? undefined : 'cursor-pointer'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (readOnly) return;
                          setSelectedStrokeId((prev) => (prev === s.id ? null : s.id));
                          setSelectedId(null);
                        }}
                      />
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={sel ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.55)'}
                        strokeWidth={sel ? 4 : 2.5}
                        strokeLinecap="round"
                        pointerEvents="none"
                      />
                    </g>
                  );
                })}
                {draftStroke && (
                  <line
                    x1={(draftStroke.x1 / 100) * vbW}
                    y1={(draftStroke.y1 / 100) * vbH}
                    x2={(draftStroke.x2 / 100) * vbW}
                    y2={(draftStroke.y2 / 100) * vbH}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    opacity={0.85}
                    pointerEvents="none"
                  />
                )}
              </g>
            )}
            {/* Pontos de aplicação */}
            {points.map((p) => {
              const { cx, cy } = toSvg(p);
              return (
                <g key={p.id}>
                  <circle
                    data-point
                    cx={cx}
                    cy={cy}
                    r={selectedId === p.id ? 14 : 12}
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    className="cursor-pointer hover:opacity-90"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (readOnly) return;
                      setSelectedId((prev) => (prev === p.id ? null : p.id));
                      setSelectedStrokeId(null);
                    }}
                  />
                </g>
              );
            })}
          </svg>
        </div>
        {displaySize == null && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {caption ?? DEFAULT_CAPTION}
            {onStrokesChange && !readOnly ? (
              <span className="mt-1 block text-xs">
                Modo <strong className="font-medium text-foreground">Riscos</strong>: arraste no mapa para traçar uma linha reta.
              </span>
            ) : null}
          </p>
        )}
      </div>
      {!readOnly && (points.length > 0 || strokes.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {selectedId && mapMode === 'points' && (
            <Button type="button" variant="destructive" size="sm" onClick={() => selectedId && removePoint(selectedId)}>
              Remover ponto selecionado
            </Button>
          )}
          {selectedStrokeId && mapMode === 'strokes' && onStrokesChange && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => selectedStrokeId && removeStroke(selectedStrokeId)}
            >
              Remover risco selecionado
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {points.length} ponto(s)
            {onStrokesChange ? ` · ${strokes.length} risco(s)` : ''}
            {mapMode === 'points'
              ? ' — clique no mapa para adicionar; no ponto para selecionar'
              : onStrokesChange
                ? ' — arraste para traçar; clique num risco grosso para selecionar'
                : ''}
          </span>
        </div>
      )}
      {readOnly && (points.length > 0 || strokes.length > 0) && displaySize == null && (
        <p className="mt-1 text-xs text-muted-foreground">
          {points.length} ponto(s)
          {strokes.length > 0 ? ` · ${strokes.length} risco(s)` : ''} no mapa
        </p>
      )}
    </div>
  );
}
