import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear?: () => void;
  height?: number;
  className?: string;
  /** Rótulo exibido acima do campo (ex.: "Assinatura do paciente", "Assinatura do profissional") */
  label?: string;
}

export function SignaturePad({ onSave, onClear, height = 200, className, label = 'Assinatura do paciente' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);

  const getCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    let x: number;
    let y: number;
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
    return {
      x: Math.max(0, Math.min(w, x)),
      y: Math.max(0, Math.min(h, y)),
    };
  }, []);

  const start = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { x, y } = getCoords(e);
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
      setHasStroke(true);
    },
    [getCoords]
  );

  const move = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const { x, y } = getCoords(e);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing, getCoords]
  );

  const end = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height || height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [height]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasStroke(false);
    onClear?.();
  }, [onClear]);

  const save = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  }, [hasStroke, onSave]);

  return (
    <div className={className}>
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div
        className="mt-2 rounded-lg border border-input bg-white dark:bg-muted/30 touch-none"
        style={{ height: `${height}px` }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block rounded-lg cursor-crosshair touch-none"
          style={{ height: `${height}px` }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
      </div>
      <div className="flex gap-2 mt-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          Limpar
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={!hasStroke}>
          Usar esta assinatura
        </Button>
      </div>
    </div>
  );
}
