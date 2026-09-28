import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Camera, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BUCKET = 'procedure-photos';
const MAX_SIZE_MB = 5;
const MAX_DIMENSION = 1280;
const ANDROID_CAMERA_DIMENSION = 640;
const ANDROID_CAMERA_QUALITY = 70;
const JPEG_QUALITY = 0.85;

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
  userId: string;
  patientId: string;
  disabled?: boolean;
  className?: string;
  onCameraOpen?: () => void;
  onCameraClose?: () => void;
  previewVisible?: boolean;
};

function getExt(file: File): string {
  const m = file.type?.match(/image\/(jpeg|png|webp|gif)/i);
  return m ? m[1]!.toLowerCase() : 'jpg';
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  (img as HTMLImageElement & { decoding?: string }).decoding = 'async';
  img.src = src;
  await img.decode();
  return img;
}

async function compressImageIfNeeded(file: File): Promise<File> {
  const needsCompression = file.size > 1.5 * 1024 * 1024;
  if (!needsCompression) return file;

  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(file);
    const img = await loadImage(objectUrl);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return file;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, dstW, dstH);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY)
    );
    if (!blob) return file;
    const out = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
    return out.size <= file.size ? out : file;
  } catch {
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function SalonSessionPhotosField({
  photos,
  onChange,
  userId,
  patientId,
  disabled,
  className,
  onCameraOpen,
  onCameraClose,
  previewVisible = true,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const clearInputs = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const uploadFile = async (file: File) => {
    const processed = await compressImageIfNeeded(file);
    const ext = getExt(processed);
    const name = `${userId}/salon/${patientId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(name, processed, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
    onChange([...photos, data.publicUrl]);
    toast.success('Foto adicionada.');
  };

  const handleFile = async (file: File | null) => {
    if (!file || disabled) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Imagem deve ter no máximo ${MAX_SIZE_MB} MB.`);
      return;
    }
    setUploading(true);
    try {
      await uploadFile(file);
    } catch {
      toast.error('Erro ao enviar foto.');
    } finally {
      setUploading(false);
      clearInputs();
    }
  };

  const handleTakePhotoNativeAndroid = async () => {
    if (disabled) return;
    setUploading(true);
    try {
      onCameraOpen?.();
      await new Promise((r) => setTimeout(r, 180));

      const photo = await CapCamera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: ANDROID_CAMERA_QUALITY,
        width: ANDROID_CAMERA_DIMENSION,
        height: ANDROID_CAMERA_DIMENSION,
        correctOrientation: true,
      });

      if (!photo.webPath) {
        toast.error('Não foi possível acessar a foto capturada.');
        return;
      }

      await new Promise((r) => setTimeout(r, 600));
      const res = await fetch(photo.webPath, { cache: 'no-store' });
      const blob = await res.blob();
      const file = new File([blob], `camera-${Date.now()}.jpg`, {
        type: blob.type || 'image/jpeg',
      });
      await uploadFile(file);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '';
      if (!/cancel/i.test(msg)) toast.error('Erro ao capturar foto.');
    } finally {
      onCameraClose?.();
      setUploading(false);
      clearInputs();
    }
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          void (async () => {
            for (const file of files) {
              await handleFile(file);
            }
          })();
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />

      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative aspect-square rounded-xl border border-input overflow-hidden bg-muted/20"
            >
              {previewVisible ? (
                <img
                  src={url}
                  alt={`Foto ${index + 1}`}
                  className="w-full h-full object-cover"
                  decoding="async"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  Foto adicionada
                </div>
              )}
              {!disabled && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full shadow-sm"
                  onClick={() => removePhoto(index)}
                  aria-label="Remover foto"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/10 p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/20 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <ImagePlus className="h-8 w-8 opacity-60" />
          )}
          <span className="text-sm font-medium">Adicionar fotos do atendimento</span>
          <span className="text-xs">Toque aqui ou use os botões abaixo</span>
        </button>
      )}

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Escolher fotos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => {
              if (Capacitor.getPlatform() === 'android') {
                void handleTakePhotoNativeAndroid();
                return;
              }
              cameraInputRef.current?.click();
            }}
            disabled={uploading}
          >
            <Camera className="h-4 w-4" />
            Tirar foto
          </Button>
        </div>
      )}
    </div>
  );
}
