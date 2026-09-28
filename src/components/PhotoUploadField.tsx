import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Camera, Upload, Loader2, X, Trash2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProfilePhotoCropDialog } from '@/components/patient/ProfilePhotoCropDialog';

const BUCKET = 'procedure-photos';
const MAX_SIZE_MB = 5;
// Câmera traseira no Android consome muita RAM; pedir resolução baixa para reduzir LMK.
const MAX_DIMENSION = 1280;
const ANDROID_CAMERA_DIMENSION = 640;
const ANDROID_CAMERA_QUALITY = 70;
const JPEG_QUALITY = 0.85;
const PROFILE_JPEG_QUALITY = 0.96;
const PROFILE_MIN_DIMENSION = 512;

interface PhotoUploadFieldProps {
  label: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  userId: string;
  instanceIdOrTemp?: string;
  disabled?: boolean;
  className?: string;
  /** Layout compacto para uso em linha (ex.: 3 colunas Frente/Lado/Costas) */
  compact?: boolean;
  /** Chamado antes de abrir a câmera (ex.: persistir estado e esconder prévias para liberar RAM) */
  onCameraOpen?: () => void;
  /** Chamado quando a câmera fecha (sucesso ou cancelamento) para restaurar prévias */
  onCameraClose?: () => void;
  /** Se false, não renderiza o <img> do preview (mostra placeholder). Reduz RAM com vários procedimentos abertos. */
  previewVisible?: boolean;
  /** Layout compacto ao lado do avatar do paciente */
  variant?: 'default' | 'profile';
}

function getExt(file: File): string {
  const m = file.type?.match(/image\/(jpeg|png|webp|gif)/i);
  return m ? m[1]!.toLowerCase() : 'jpg';
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  // evita travar decode em alguns webviews
  (img as any).decoding = 'async';
  img.src = src;
  await img.decode();
  return img;
}

async function compressImageIfNeeded(file: File): Promise<File> {
  // Só processa imagens grandes; evita custo em arquivos pequenos
  const needsCompression = file.size > 1.5 * 1024 * 1024;
  if (!needsCompression) return file;

  let objectUrl: string | null = null;
  try {
    // Usar objectURL evita carregar o arquivo inteiro em base64 na memória de cara
    objectUrl = URL.createObjectURL(file);
    const img = await loadImage(objectUrl);

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return file;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    // Se não precisar redimensionar, ainda convertemos para JPEG para reduzir tamanho em alguns casos
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

async function compressProfilePhotoIfNeeded(file: File): Promise<File> {
  if (file.size <= MAX_SIZE_MB * 1024 * 1024) return file;

  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(file);
    const img = await loadImage(objectUrl);

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return file;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(srcW, srcH));
    let dstW = Math.max(PROFILE_MIN_DIMENSION, Math.round(srcW * scale));
    let dstH = Math.max(PROFILE_MIN_DIMENSION, Math.round(srcH * scale));

    if (dstW > MAX_DIMENSION) {
      dstH = Math.round((dstH * MAX_DIMENSION) / dstW);
      dstW = MAX_DIMENSION;
    }
    if (dstH > MAX_DIMENSION) {
      dstW = Math.round((dstW * MAX_DIMENSION) / dstH);
      dstH = MAX_DIMENSION;
    }

    const canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return file;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, dstW, dstH);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', PROFILE_JPEG_QUALITY)
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

export function PhotoUploadField({
  label,
  value,
  onChange,
  userId,
  instanceIdOrTemp = 'temp',
  disabled,
  className,
  compact,
  onCameraOpen,
  onCameraClose,
  previewVisible = true,
  variant = 'default',
}: PhotoUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingCrop, setPendingCrop] = useState<{ src: string; fileName: string } | null>(null);

  const clearFileInputs = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const uploadProcessedFile = async (file: File) => {
    const processed =
      variant === 'profile'
        ? await compressProfilePhotoIfNeeded(file)
        : await compressImageIfNeeded(file);
    await new Promise((r) => setTimeout(r, 0));
    await uploadFile(processed);
    toast.success('Foto adicionada.');
  };

  const uploadFile = async (file: File) => {
    const ext = getExt(file);
    const name = `${userId}/${instanceIdOrTemp}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(name, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
    onChange(data.publicUrl);
  };

  const handleFile = async (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Imagem deve ter no máximo ${MAX_SIZE_MB} MB.`);
      return;
    }

    if (variant === 'profile') {
      try {
        const src = await fileToDataUrl(file);
        setPendingCrop({ src, fileName: file.name });
      } catch {
        toast.error('Não foi possível abrir a imagem.');
      } finally {
        clearFileInputs();
      }
      return;
    }

    setUploading(true);
    try {
      await uploadProcessedFile(file);
    } catch {
      toast.error('Erro ao enviar foto.');
    } finally {
      setUploading(false);
      clearFileInputs();
    }
  };

  async function handleCropConfirm(blob: Blob) {
    setUploading(true);
    try {
      const file = new File([blob], `profile-${Date.now()}.jpg`, { type: 'image/jpeg' });
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`Imagem deve ter no máximo ${MAX_SIZE_MB} MB.`);
        return;
      }
      await uploadProcessedFile(file);
    } catch {
      toast.error('Erro ao enviar foto.');
    } finally {
      setUploading(false);
      setPendingCrop(null);
      clearFileInputs();
    }
  }

  const handleTakePhotoNativeAndroid = async () => {
    setUploading(true);
    try {
      // 1) Página persiste estado e esconde TODAS as prévias (libera RAM antes da câmera traseira)
      onCameraOpen?.();
      // 2) Espera o React re-renderizar com prévias escondidas para o GC poder liberar bitmaps
      await new Promise((r) => setTimeout(r, 180));

      const photo = await CapCamera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: variant === 'profile' ? 90 : ANDROID_CAMERA_QUALITY,
        width: variant === 'profile' ? 1280 : ANDROID_CAMERA_DIMENSION,
        height: variant === 'profile' ? 1280 : ANDROID_CAMERA_DIMENSION,
        correctOrientation: true,
      });

      if (!photo.webPath) {
        toast.error('Não foi possível acessar a foto capturada.');
        return;
      }

      // 3) Atrasa fetch/upload para o WebView estabilizar após voltar da câmera (câmera traseira usa muita RAM)
      await new Promise((r) => setTimeout(r, 600));

      const res = await fetch(photo.webPath, { cache: 'no-store' });
      const blob = await res.blob();
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`Imagem muito grande. Tente novamente (máx. ${MAX_SIZE_MB} MB).`);
        return;
      }

      if (variant === 'profile') {
        const src = await fileToDataUrl(file);
        setPendingCrop({ src, fileName: file.name });
        return;
      }

      await uploadFile(file);
      toast.success('Foto adicionada.');
    } catch (e: unknown) {
      if ((e as { message?: string })?.message?.includes('User cancelled')) return;
      toast.error('Não foi possível tirar/enviar a foto. Tente novamente.');
    } finally {
      onCameraClose?.();
      setUploading(false);
    }
  };

  const shortLabel = compact && /^Foto atual - (.+)$/i.test(label) ? label.replace(/^Foto atual - /i, '').trim() : label;

  if (compact) {
    return (
      <div className={className}>
        <p className="text-center text-sm font-medium text-foreground mb-2">{shortLabel}</p>
        <div className="rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 overflow-hidden">
          {value ? (
            <div className="relative aspect-square w-full">
              {previewVisible ? (
                <img src={value} alt={shortLabel} className="w-full h-full object-cover" decoding="async" loading="lazy" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-muted/30 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">Foto adicionada</span>
                </div>
              )}
              {!disabled && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full shadow-sm"
                  onClick={() => onChange(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ) : (
            <div className="aspect-square w-full flex flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
              <Camera className="h-10 w-10 opacity-50" />
              <span className="text-xs">Enviar ou tirar foto</span>
            </div>
          )}
          {!disabled && (
            <div className="flex border-t border-border/50 bg-background/50 p-2 gap-2 justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-9 w-9 shrink-0"
                title="Escolher arquivo"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (Capacitor.getPlatform() === 'android') {
                    void handleTakePhotoNativeAndroid();
                    return;
                  }
                  cameraInputRef.current?.click();
                }}
                disabled={uploading}
                className="h-9 w-9 shrink-0"
                title="Tirar foto"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const fileInputs = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </>
  );

  const profileActionButtonClass =
    'h-10 gap-2 rounded-lg border-0 bg-primary/10 px-4 text-primary shadow-sm hover:bg-primary/15 hover:text-primary';

  const chooseFileButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => fileInputRef.current?.click()}
      disabled={uploading}
      className={variant === 'profile' ? profileActionButtonClass : 'gap-2'}
    >
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      Escolher arquivo
    </Button>
  );

  const takePhotoButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        if (Capacitor.getPlatform() === 'android') {
          void handleTakePhotoNativeAndroid();
          return;
        }
        cameraInputRef.current?.click();
      }}
      disabled={uploading}
      className={
        variant === 'profile'
          ? 'h-10 gap-2 rounded-lg border-0 bg-foreground px-4 text-background shadow-sm hover:bg-foreground/90 hover:text-background'
          : 'gap-2'
      }
    >
      <Camera className="h-4 w-4" />
      Tirar foto
    </Button>
  );

  if (variant === 'profile') {
    return (
      <>
        <div className={cn('min-w-0 flex-1', className)}>
          {label ? <p className="mb-2.5 text-sm font-semibold text-foreground">{label}</p> : null}
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-4 sm:px-5">
            {!disabled ? (
              <>
                {fileInputs}
                <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                  {chooseFileButton}
                  {takePhotoButton}
                  {value ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onChange(null)}
                      disabled={uploading}
                      className={profileActionButtonClass}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover foto
                    </Button>
                  ) : null}
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground sm:text-left">
                  Formatos: JPG, PNG. Máx {MAX_SIZE_MB}MB.
                </p>
              </>
            ) : null}
          </div>
        </div>
        <ProfilePhotoCropDialog
          open={!!pendingCrop}
          imageSrc={pendingCrop?.src ?? null}
          onOpenChange={(open) => {
            if (!open) setPendingCrop(null);
          }}
          onConfirm={handleCropConfirm}
        />
      </>
    );
  }

  return (
    <div className={className}>
      <Label className="text-muted-foreground">{label}</Label>
      <div className="mt-2 rounded-lg border border-dashed border-muted-foreground/30 p-4 space-y-3">
        {value ? (
          <div className="relative inline-block">
            {previewVisible ? (
              <img src={value} alt={label} className="h-32 w-auto max-w-full rounded-md object-cover border bg-muted" decoding="async" loading="lazy" />
            ) : (
              <div className="h-32 min-w-[120px] flex items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">Foto adicionada</div>
            )}
            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-7 w-7 rounded-full"
                onClick={() => onChange(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : null}
        {!disabled && (
          <div className="flex flex-wrap gap-2">
            {fileInputs}
            {chooseFileButton}
            {takePhotoButton}
          </div>
        )}
      </div>
    </div>
  );
}
