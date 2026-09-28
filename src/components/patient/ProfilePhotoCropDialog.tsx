import { useCallback, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { getCroppedImageBlob, PROFILE_PHOTO_JPEG_QUALITY, PROFILE_PHOTO_MAX_PX, PROFILE_PHOTO_MIN_PX } from '@/lib/cropImage';

type ProfilePhotoCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
};

export function ProfilePhotoCropDialog({
  open,
  imageSrc,
  onOpenChange,
  onConfirm,
}: ProfilePhotoCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next && saving) return;
    if (!next) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, {
        quality: PROFILE_PHOTO_JPEG_QUALITY,
        minOutputSize: PROFILE_PHOTO_MIN_PX,
        maxOutputSize: PROFILE_PHOTO_MAX_PX,
      });
      await onConfirm(blob);
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-4 p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle>Ajustar foto</DialogTitle>
          <DialogDescription>
            Arraste a imagem para posicionar. Use o zoom para aproximar ou afastar.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-[min(58vh,360px)] w-full overflow-hidden rounded-xl bg-muted">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid
              minZoom={1}
              maxZoom={4}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <div className="space-y-2 px-1">
          <p className="text-xs font-medium text-muted-foreground">Zoom</p>
          <Slider
            value={[zoom]}
            min={1}
            max={4}
            step={0.02}
            onValueChange={(value) => setZoom(value[0] ?? 1)}
            aria-label="Zoom da foto"
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">Formatos: JPG, PNG. Máx 5MB.</p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={saving || !croppedAreaPixels}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Usar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
