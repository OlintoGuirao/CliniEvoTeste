import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Syringe, Camera, ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FieldDefinition } from '@/pages/TreatmentTypes';

export interface TreatmentTypeWithFields {
  id: string;
  name: string;
  subtitle?: string | null;
  field_definitions?: { fields: FieldDefinition[] } | null;
}

export type FieldValue = string | string[] | number | null | Record<string, string>;

interface TreatmentTypeFieldsCardProps {
  treatmentType: TreatmentTypeWithFields;
  values: Record<string, FieldValue>;
  onChange: (fieldId: string, value: FieldValue) => void;
  /** Callback para upload de foto; retorna o path/URL. Para múltiplas fotos, slotId é o id do slot. */
  onPhotoUpload?: (fieldId: string, file: File, slotId?: string) => Promise<string | null>;
  /** Chamado quando o usuário seleciona um arquivo (para o pai guardar o File e fazer upload depois, ex.: ao salvar sessão). */
  onPhotoFileSelect?: (fieldId: string, file: File, slotId?: string) => void;
  /** Chamado quando o usuário remove uma foto (para o pai limpar o File guardado). */
  onPhotoClear?: (fieldId: string, slotId?: string) => void;
  /** Opcional: retorna URL de prévia para um path já salvo (ex.: signed URL do storage). */
  getPhotoPreviewUrl?: (path: string) => string;
  /** Se true, renderiza apenas o grid de campos (sem Card/título), para uso em diálogos. */
  noCard?: boolean;
}

export function TreatmentTypeFieldsCard({
  treatmentType,
  values,
  onChange,
  onPhotoUpload,
  onPhotoFileSelect,
  onPhotoClear,
  getPhotoPreviewUrl,
  noCard = false,
}: TreatmentTypeFieldsCardProps) {
  const fields = treatmentType.field_definitions?.fields ?? [];
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (fields.length === 0) return null;

  const title = treatmentType.subtitle?.trim() || treatmentType.name;
  const description =
    'Campos configurados para este tratamento — pode preencher ao cadastrar ou depois em Nova Aplicação';

  /** IMC = peso (kg) / altura² (m). Altura: se valor > 3 assume cm e converte para m. */
  function computeIMC(weightVal: FieldValue, heightVal: FieldValue): number | null {
    const w = typeof weightVal === 'number' ? weightVal : (typeof weightVal === 'string' ? parseFloat(weightVal.replace(',', '.')) : null);
    let h = typeof heightVal === 'number' ? heightVal : (typeof heightVal === 'string' ? parseFloat(heightVal.replace(',', '.')) : null);
    if (w == null || h == null || Number.isNaN(w) || Number.isNaN(h) || h <= 0) return null;
    if (h > 3) h = h / 100;
    const imc = w / (h * h);
    return Number.isFinite(imc) ? imc : null;
  }

  useEffect(() => {
    fields.forEach((field) => {
      if (field.type !== 'imc' || !field.options?.length) return;
      const weightFieldId = field.options[0]?.id;
      const heightFieldId = field.options[1]?.id;
      if (!weightFieldId || !heightFieldId) return;
      const imc = computeIMC(values[weightFieldId], values[heightFieldId]);
      const current = values[field.id];
      const currentNum = typeof current === 'number' ? current : (typeof current === 'string' ? parseFloat(current) : null);
      if (imc != null && (currentNum == null || Math.abs(currentNum - imc) > 0.01)) {
        onChange(field.id, Math.round(imc * 10) / 10);
      } else if (imc == null && (currentNum != null || current !== undefined)) {
        onChange(field.id, null);
      }
    });
  }, [fields, values, onChange]);

  const handlePhotoSelect = async (fieldId: string, file: File | null, slotId?: string) => {
    if (!file || !file.type.startsWith('image/')) return;
    const uploadKey = slotId ? `${fieldId}_${slotId}` : fieldId;
    onPhotoFileSelect?.(fieldId, file, slotId);
    if (onPhotoUpload) {
      setUploadingPhoto(uploadKey);
      try {
        const path = await onPhotoUpload(fieldId, file, slotId);
        if (path) {
          if (slotId) {
            const current = (values[fieldId] as Record<string, string>) ?? {};
            onChange(fieldId, { ...current, [slotId]: path });
          } else {
            onChange(fieldId, path);
          }
        }
      } catch {
        toast.error('Erro ao enviar foto.');
      } finally {
        setUploadingPhoto(null);
      }
    } else {
      const url = URL.createObjectURL(file);
      setPhotoPreviews((p) => ({ ...p, [uploadKey]: url }));
      if (slotId) {
        const current = (values[fieldId] as Record<string, string>) ?? {};
        onChange(fieldId, { ...current, [slotId]: url });
      } else {
        onChange(fieldId, url);
      }
      toast.info('Salve o formulário para enviar a foto.');
    }
  };

  const clearPhoto = (fieldId: string, slotId?: string) => {
    onPhotoClear?.(fieldId, slotId);
    if (slotId) {
      const uploadKey = `${fieldId}_${slotId}`;
      if (photoPreviews[uploadKey]) {
        URL.revokeObjectURL(photoPreviews[uploadKey]);
        setPhotoPreviews((p) => {
          const next = { ...p };
          delete next[uploadKey];
          return next;
        });
      }
      const current = (values[fieldId] as Record<string, string>) ?? {};
      const next = { ...current };
      delete next[slotId];
      onChange(fieldId, Object.keys(next).length ? next : null);
    } else {
      if (photoPreviews[fieldId]) {
        URL.revokeObjectURL(photoPreviews[fieldId]);
        setPhotoPreviews((p) => {
          const next = { ...p };
          delete next[fieldId];
          return next;
        });
      }
      onChange(fieldId, null);
    }
  };

  const fieldsGrid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start min-w-0 overflow-hidden">
            {fields.map((field) => {
              const isFullWidth = field.type === 'select_multi' || field.type === 'photo' || field.type === 'multiple_photos' || field.type === 'textarea';
              const rawPhotoValue = values[field.id];
              const photoStr = typeof rawPhotoValue === 'string' ? rawPhotoValue : '';
              const previewUrl = photoStr
                ? getPhotoPreviewUrl?.(photoStr) ?? (photoStr.startsWith('http') || photoStr.startsWith('blob') ? photoStr : null)
                : photoPreviews[field.id] ?? null;
              const isUploading = uploadingPhoto === field.id;
              const multiplePhotosValue = (values[field.id] as Record<string, string>) ?? {};
              const slots = field.type === 'multiple_photos' ? (field.options ?? []) : [];

              return (
                <div
                  key={field.id}
                  className={`space-y-2 min-w-0 flex flex-col ${isFullWidth ? 'sm:col-span-2 lg:col-span-3' : ''}`}
                >
                  <div className={isFullWidth ? undefined : 'min-h-[2.5rem] min-w-0 flex items-end'}>
                    <Label htmlFor={`tt-${field.id}`} className="break-words">{field.label}</Label>
                  </div>
                  {field.type === 'text' && (
                    <Input
                      id={`tt-${field.id}`}
                      type="text"
                      placeholder={field.placeholder}
                      value={(values[field.id] as string) ?? ''}
                      onChange={(e) => onChange(field.id, e.target.value)}
                    />
                  )}
                  {field.type === 'date' && (
                    <Input
                      id={`tt-${field.id}`}
                      type="date"
                      value={(values[field.id] as string) ?? new Date().toISOString().slice(0, 10)}
                      onChange={(e) => onChange(field.id, e.target.value)}
                    />
                  )}
                  {field.type === 'number' && (
                    <Input
                      id={`tt-${field.id}`}
                      type="text"
                      inputMode="decimal"
                      placeholder={field.placeholder}
                      value={(values[field.id] as string | number) ?? ''}
                      onChange={(e) => onChange(field.id, e.target.value)}
                    />
                  )}
                  {field.type === 'textarea' && (
                    <Textarea
                      id={`tt-${field.id}`}
                      placeholder={field.placeholder ?? 'Observações do profissional...'}
                      value={(values[field.id] as string) ?? ''}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      className="min-h-[100px] resize-y"
                      rows={4}
                    />
                  )}
                  {field.type === 'imc' && (() => {
                    const weightFieldId = field.options?.[0]?.id;
                    const heightFieldId = field.options?.[1]?.id;
                    const hasValidConfig = !!(weightFieldId && heightFieldId);
                    const imc = hasValidConfig
                      ? computeIMC(values[weightFieldId], values[heightFieldId])
                      : null;
                    const display = imc != null ? imc.toFixed(1) : '';
                    return (
                      <div className="space-y-1">
                        {!hasValidConfig ? (
                          <p className="text-sm text-amber-600 dark:text-amber-500 py-2 px-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                            Para o IMC funcionar, edite este tipo em <strong>Tipos de Tratamento</strong> e selecione os campos <strong>Peso</strong> e <strong>Altura</strong> nos dois dropdowns do campo IMC.
                          </p>
                        ) : (
                          <>
                            <Input
                              id={`tt-${field.id}`}
                              readOnly
                              className="bg-muted/50 font-medium"
                              value={display}
                              placeholder="Preencha peso e altura nos campos acima"
                            />
                          </>
                        )}
                      </div>
                    );
                  })()}
                  {field.type === 'select_single' && (
                    <Select
                      value={((values[field.id] as string) ?? '') || undefined}
                      onValueChange={(v) => onChange(field.id, v)}
                    >
                      <SelectTrigger id={`tt-${field.id}`}>
                        <SelectValue placeholder={`Selecione ${field.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {field.type === 'protocol' && (
                    <Select
                      value={((values[field.id] as string) ?? '') || undefined}
                      onValueChange={(v) => onChange(field.id, v)}
                    >
                      <SelectTrigger id={`tt-${field.id}`}>
                        <SelectValue placeholder={`Selecione ${field.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {field.type === 'select_multi' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 rounded-md border p-4">
                      {field.options?.map((opt) => {
                        const current = (values[field.id] as string[]) ?? [];
                        const checked = current.includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className="flex items-center gap-2 cursor-pointer min-h-[2rem]"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => {
                                const next = checked
                                  ? current.filter((id) => id !== opt.id)
                                  : [...current, opt.id];
                                onChange(field.id, next);
                              }}
                            />
                            <span className="text-sm leading-tight">{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {field.type === 'photo' && (
                    <div className="rounded-lg border border-input bg-muted/20 p-4 space-y-3">
                      <input
                        ref={(el) => { fileInputRefs.current[field.id] = el; }}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePhotoSelect(field.id, f);
                          e.target.value = '';
                        }}
                      />
                      {previewUrl ? (
                        <div className="relative inline-block">
                          <img
                            src={previewUrl}
                            alt={field.label}
                            className="max-h-40 rounded-md object-cover border"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute top-1 right-1 h-8 w-8"
                            onClick={() => clearPhoto(field.id)}
                            aria-label="Remover foto"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : photoStr ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Foto enviada</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => clearPhoto(field.id)}
                            aria-label="Remover foto"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => fileInputRefs.current[field.id]?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                            Escolher arquivo
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => fileInputRefs.current[field.id]?.click()}
                            disabled={isUploading}
                          >
                            <Camera className="w-4 h-4" />
                            Tirar foto
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {field.type === 'multiple_photos' && (
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground">
                        Adicione ou tire fotos para cada posição — para comparação Antes x Depois
                      </p>
                      {slots.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Configure os slots em Tipos de Tratamento (ex.: Frente, Lado, Costas).</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                          {slots.map((slot) => {
                            const slotPath = multiplePhotosValue[slot.id];
                            const slotPreviewUrl = slotPath
                              ? getPhotoPreviewUrl?.(slotPath) ?? (slotPath.startsWith('http') || slotPath.startsWith('blob') ? slotPath : null)
                              : photoPreviews[`${field.id}_${slot.id}`] ?? null;
                            const slotUploadKey = `${field.id}_${slot.id}`;
                            const isSlotUploading = uploadingPhoto === slotUploadKey;
                            return (
                              <div key={slot.id} className="space-y-2 min-w-0 flex flex-col">
                                <div className="min-h-[2.5rem] flex items-end shrink-0">
                                  <Label className="text-sm font-medium">{slot.label}</Label>
                                </div>
                                <input
                                  ref={(el) => { fileInputRefs.current[slotUploadKey] = el; }}
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handlePhotoSelect(field.id, f, slot.id);
                                    e.target.value = '';
                                  }}
                                />
                                <div
                                  onClick={() => !slotPreviewUrl && !slotPath && fileInputRefs.current[slotUploadKey]?.click()}
                                  className={`rounded-lg border-2 border-dashed p-4 min-h-[120px] w-full flex flex-col items-center justify-center gap-2 transition-colors flex-1 ${
                                    slotPreviewUrl || slotPath
                                      ? 'border-border bg-muted/20'
                                      : 'border-muted-foreground/30 bg-muted/10 hover:bg-muted/20 cursor-pointer'
                                  }`}
                                >
                                  {slotPreviewUrl ? (
                                    <div className="relative w-full aspect-square max-h-40 rounded overflow-hidden">
                                      <img src={slotPreviewUrl} alt={slot.label} className="w-full h-full object-cover" />
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="icon"
                                        className="absolute top-1 right-1 h-7 w-7"
                                        onClick={(e) => { e.stopPropagation(); clearPhoto(field.id, slot.id); }}
                                        aria-label="Remover foto"
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ) : slotPath && !slotPreviewUrl ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-muted-foreground">Foto enviada</span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); clearPhoto(field.id, slot.id); }}
                                        aria-label="Remover foto"
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <ImagePlus className="w-8 h-8 text-muted-foreground" />
                                      <span className="text-sm text-muted-foreground text-center">
                                        {isSlotUploading ? 'Enviando...' : 'Adicionar ou tirar foto'}
                                      </span>
                                      {isSlotUploading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
  );

  if (noCard) return <div className="space-y-4 min-w-0">{fieldsGrid}</div>;

  return (
    <div className="md:col-span-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Syringe className="w-5 h-5" />
            {title} (opcional)
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{fieldsGrid}</CardContent>
      </Card>
    </div>
  );
}
