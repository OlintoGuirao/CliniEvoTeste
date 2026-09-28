import { useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Upload, Images, Trash2, ImagePlus } from 'lucide-react';

const BUCKET = 'procedure-photos';
const MAX_UPLOAD_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;
const KEEP_ORIGINAL_LIMIT_BYTES = 1.4 * 1024 * 1024; // ~1.4MB

export type GalleryImage = {
  id: string;
  url: string;
};

export type ComparisonPair = {
  id: string;
  beforeImageId: string;
  afterImageId: string;
  caption: string;
};

export type BeforeAfterGalleryValue = {
  beforeImages: GalleryImage[];
  afterImages: GalleryImage[];
  pairs: ComparisonPair[];
};

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= KEEP_ORIGINAL_LIMIT_BYTES) return file;
  try {
    const src = await fileToDataUrl(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Falha ao abrir imagem'));
      i.src = src;
    });
    const maxSide = Math.max(img.naturalWidth, img.naturalHeight);
    const ratio = maxSide > MAX_UPLOAD_DIMENSION ? MAX_UPLOAD_DIMENSION / maxSide : 1;
    const dstW = Math.max(1, Math.round(img.naturalWidth * ratio));
    const dstH = Math.max(1, Math.round(img.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, dstW, dstH);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY);
    });
    if (!blob) return file;
    const out = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
    return out.size > 0 ? out : file;
  } catch {
    return file;
  }
}

type BeforeAfterGalleryCardProps = {
  title?: string;
  description?: string;
  userId: string;
  instanceIdOrTemp: string;
  value: BeforeAfterGalleryValue;
  onChange: (next: BeforeAfterGalleryValue) => void;
  disabled?: boolean;
};

function SortableImageRow({
  image,
  onRemove,
}: {
  image: GalleryImage;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: image.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-border bg-card p-2">
      <div className="flex items-center gap-2">
        <button type="button" className="text-muted-foreground" {...attributes} {...listeners} aria-label="Reordenar imagem">
          <GripVertical className="h-4 w-4" />
        </button>
        <img src={image.url} alt="Imagem da galeria" className="h-14 w-14 rounded-md object-cover border border-input" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{image.id}</p>
        </div>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => onRemove(image.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function BeforeAfterGalleryCard({
  title = 'Galeria de Fotos',
  description = 'Upload, organização e comparação de imagens antes/depois.',
  userId,
  instanceIdOrTemp,
  value,
  onChange,
  disabled,
}: BeforeAfterGalleryCardProps) {
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const viewMode: 'side-by-side' = 'side-by-side';
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const canGenerate = value.beforeImages.length > 0 && value.beforeImages.length === value.afterImages.length;

  const imageById = useMemo(() => {
    const map = new Map<string, GalleryImage>();
    [...value.beforeImages, ...value.afterImages].forEach((img) => map.set(img.id, img));
    return map;
  }, [value.beforeImages, value.afterImages]);

  const uploadFiles = async (files: FileList, group: 'before' | 'after') => {
    if (!userId) {
      toast.error('Usuário não encontrado para upload.');
      return;
    }
    const valid = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (valid.length === 0) return;
    group === 'before' ? setUploadingBefore(true) : setUploadingAfter(true);
    try {
      const uploaded: GalleryImage[] = [];
      for (const file of valid) {
        const processed = await compressImageForUpload(file);
        const ext = (processed.type.split('/')[1] || 'jpg').toLowerCase();
        const name = `${userId}/${instanceIdOrTemp}/gallery-${group}-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(name, processed, {
          cacheControl: '3600',
          upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
        uploaded.push({ id: crypto.randomUUID(), url: data.publicUrl });
      }
      if (uploaded.length > 0) {
        if (group === 'before') {
          onChange({ ...value, beforeImages: [...value.beforeImages, ...uploaded] });
        } else {
          onChange({ ...value, afterImages: [...value.afterImages, ...uploaded] });
        }
      }
      toast.success(`${uploaded.length} imagem(ns) adicionada(s) em ${group === 'before' ? 'ANTES' : 'DEPOIS'}.`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao enviar imagens.');
    } finally {
      group === 'before' ? setUploadingBefore(false) : setUploadingAfter(false);
    }
  };

  const handleReorder = (event: DragEndEvent, group: 'before' | 'after') => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const source = group === 'before' ? value.beforeImages : value.afterImages;
    const oldIndex = source.findIndex((i) => i.id === active.id);
    const newIndex = source.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(source, oldIndex, newIndex);
    if (group === 'before') onChange({ ...value, beforeImages: reordered });
    else onChange({ ...value, afterImages: reordered });
  };

  const removeImage = (group: 'before' | 'after', imageId: string) => {
    const nextBefore = group === 'before' ? value.beforeImages.filter((i) => i.id !== imageId) : value.beforeImages;
    const nextAfter = group === 'after' ? value.afterImages.filter((i) => i.id !== imageId) : value.afterImages;
    const nextPairs = value.pairs.filter((p) => p.beforeImageId !== imageId && p.afterImageId !== imageId);
    onChange({ beforeImages: nextBefore, afterImages: nextAfter, pairs: nextPairs });
  };

  const generatePairs = () => {
    if (!canGenerate) return;
    const pairs: ComparisonPair[] = value.beforeImages.map((before, idx) => ({
      id: crypto.randomUUID(),
      beforeImageId: before.id,
      afterImageId: value.afterImages[idx]?.id ?? '',
      caption: '',
    }));
    onChange({ ...value, pairs });
    toast.success('Pares de comparação gerados.');
  };

  const reorderPairs = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = value.pairs.findIndex((p) => p.id === active.id);
    const newIndex = value.pairs.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange({ ...value, pairs: arrayMove(value.pairs, oldIndex, newIndex) });
  };

  return (
    <Card>
      <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-6">
        <CardTitle className="text-sm md:text-base flex items-center gap-2">
          <Images className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-3 md:p-6 pt-0 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3 rounded-xl border border-border bg-muted/10 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold tracking-wide text-foreground">ANTES</Label>
              <Badge variant="secondary" className="rounded-full px-2.5">{value.beforeImages.length}</Badge>
            </div>
            <input
              ref={beforeInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={disabled || uploadingBefore}
              onChange={(e) => e.target.files && void uploadFiles(e.target.files, 'before')}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center gap-2 rounded-xl border-dashed"
              disabled={disabled || uploadingBefore}
              onClick={() => beforeInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              {uploadingBefore ? 'Enviando...' : 'Adicionar imagens de antes'}
            </Button>
            {value.beforeImages.length === 0 && (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border px-3 py-2 bg-background/40">
                Nenhuma imagem adicionada ainda.
              </p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleReorder(e, 'before')}>
              <SortableContext items={value.beforeImages.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {value.beforeImages.map((img) => (
                    <SortableImageRow key={img.id} image={img} onRemove={(id) => removeImage('before', id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/10 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold tracking-wide text-foreground">DEPOIS</Label>
              <Badge variant="secondary" className="rounded-full px-2.5">{value.afterImages.length}</Badge>
            </div>
            <input
              ref={afterInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={disabled || uploadingAfter}
              onChange={(e) => e.target.files && void uploadFiles(e.target.files, 'after')}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center gap-2 rounded-xl border-dashed"
              disabled={disabled || uploadingAfter}
              onClick={() => afterInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              {uploadingAfter ? 'Enviando...' : 'Adicionar imagens de depois'}
            </Button>
            {value.afterImages.length === 0 && (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border px-3 py-2 bg-background/40">
                Nenhuma imagem adicionada ainda.
              </p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleReorder(e, 'after')}>
              <SortableContext items={value.afterImages.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {value.afterImages.map((img) => (
                    <SortableImageRow key={img.id} image={img} onRemove={(id) => removeImage('after', id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 bg-muted/20 space-y-2">
          <Button type="button" onClick={generatePairs} disabled={!canGenerate || disabled} className="rounded-xl">
            Gerar Antes e Depois
          </Button>
          {!canGenerate && (
            <p className="text-xs text-muted-foreground">
              Para gerar, as listas ANTES e DEPOIS precisam ter a mesma quantidade e pelo menos 1 imagem.
            </p>
          )}
        </div>

        {value.pairs.length > 0 && (
          <div className="space-y-3">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderPairs}>
              <SortableContext items={value.pairs.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {value.pairs.map((pair) => {
                    const before = imageById.get(pair.beforeImageId);
                    const after = imageById.get(pair.afterImageId);
                    return (
                      <PairEditor
                        key={pair.id}
                        pair={pair}
                        beforeImages={value.beforeImages}
                        afterImages={value.afterImages}
                        before={before}
                        after={after}
                        viewMode={viewMode}
                        slider={50}
                        onSliderChange={() => undefined}
                        onChange={(nextPair) => {
                          onChange({
                            ...value,
                            pairs: value.pairs.map((p) => (p.id === pair.id ? nextPair : p)),
                          });
                        }}
                        onRemove={() => onChange({ ...value, pairs: value.pairs.filter((p) => p.id !== pair.id) })}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PairEditor({
  pair,
  beforeImages,
  afterImages,
  before,
  after,
  viewMode,
  slider,
  onSliderChange,
  onChange,
  onRemove,
}: {
  pair: ComparisonPair;
  beforeImages: GalleryImage[];
  afterImages: GalleryImage[];
  before?: GalleryImage;
  after?: GalleryImage;
  viewMode: 'side-by-side' | 'slider';
  slider: number;
  onSliderChange: (value: number) => void;
  onChange: (pair: ComparisonPair) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: pair.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-border p-3 space-y-3 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button type="button" {...attributes} {...listeners} className="text-muted-foreground" aria-label="Reordenar par">
            <GripVertical className="h-4 w-4" />
          </button>
          Par de comparação
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          ANTES
          <select
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            value={pair.beforeImageId}
            onChange={(e) => onChange({ ...pair, beforeImageId: e.target.value })}
          >
            {beforeImages.map((img, i) => (
              <option key={img.id} value={img.id}>
                Antes {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          DEPOIS
          <select
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            value={pair.afterImageId}
            onChange={(e) => onChange({ ...pair, afterImageId: e.target.value })}
          >
            {afterImages.map((img, i) => (
              <option key={img.id} value={img.id}>
                Depois {i + 1}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Input
        placeholder="Legenda do par (opcional)"
        value={pair.caption}
        onChange={(e) => onChange({ ...pair, caption: e.target.value })}
      />

      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="rounded-lg border overflow-hidden bg-muted/20">
            {before ? <img src={before.url} alt="Antes" className="w-full aspect-square object-cover" /> : <div className="aspect-square" />}
          </div>
          <div className="rounded-lg border overflow-hidden bg-muted/20">
            {after ? <img src={after.url} alt="Depois" className="w-full aspect-square object-cover" /> : <div className="aspect-square" />}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative w-full overflow-hidden rounded-lg border bg-muted/20" style={{ aspectRatio: '1 / 1' }}>
            {before && <img src={before.url} alt="Antes" className="absolute inset-0 h-full w-full object-cover" />}
            {after && (
              <img
                src={after.url}
                alt="Depois"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ clipPath: `inset(0 0 0 ${slider}%)` }}
              />
            )}
          </div>
          <input type="range" min={0} max={100} value={slider} onChange={(e) => onSliderChange(Number(e.target.value))} className="w-full" />
        </div>
      )}
    </div>
  );
}

