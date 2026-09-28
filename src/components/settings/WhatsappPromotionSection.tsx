import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Film, ImageIcon, Loader2, Megaphone, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  broadcastWhatsappPromotion,
  contentTypeLabel,
  deleteWhatsappPromotion,
  fetchWhatsappPromotionHistory,
  setWhatsappPromotionMenuEnabled,
  updateWhatsappPromotion,
  uploadPromotionMedia,
  type WhatsappPromotionContentType,
  type WhatsappPromotionRow,
} from '@/lib/whatsappPromotions';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';

const CONTENT_OPTIONS: Array<{ value: WhatsappPromotionContentType; label: string; hint: string }> = [
  { value: 'text', label: 'Somente texto', hint: 'Mensagem personalizada para todos os pacientes.' },
  { value: 'text_image', label: 'Texto + imagem', hint: 'Texto como legenda da imagem.' },
  { value: 'image', label: 'Somente imagem', hint: 'Envia apenas a imagem (legenda opcional).' },
  { value: 'video', label: 'Vídeo', hint: 'Envia um vídeo (legenda opcional).' },
];

function formatDateBR(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function emptyForm() {
  return {
    contentType: 'text' as WhatsappPromotionContentType,
    promotionTitle: '',
    messageText: '',
    detailsText: '',
    maxParticipants: '',
    menuEnabled: true,
    procedureId: '',
  };
}

export function WhatsappPromotionSection({
  showPromotions = true,
  showHistory = true,
}: {
  showPromotions?: boolean;
  showHistory?: boolean;
}) {
  const { profile } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoPreviewName, setVideoPreviewName] = useState<string | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WhatsappPromotionRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<WhatsappPromotionRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [procedures, setProcedures] = useState<Array<{ id: string; name: string; category: string }>>([]);

  const { contentType, promotionTitle, messageText, detailsText, maxParticipants, menuEnabled, procedureId } =
    form;
  const needsText = contentType === 'text' || contentType === 'text_image';
  const needsImage = contentType === 'text_image' || contentType === 'image';
  const needsVideo = contentType === 'video';
  const optionalCaption = contentType === 'image' || contentType === 'video';
  const isEditing = Boolean(editingId);

  const loadPromotions = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingList(true);
    try {
      const [histResult, procsResult] = await Promise.allSettled([
        fetchWhatsappPromotionHistory(profile.id),
        getProceduresForProfile(profile.id),
      ]);
      if (histResult.status === 'fulfilled') {
        setPromotions(histResult.value);
      } else {
        setPromotions([]);
      }
      if (procsResult.status === 'fulfilled') {
        setProcedures(
          (procsResult.value || [])
            .filter((p) => p.is_active !== false)
            .map((p) => ({ id: p.id, name: p.name, category: p.category || '' }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        );
      } else {
        setProcedures([]);
      }
    } catch {
      setPromotions([]);
      setProcedures([]);
    } finally {
      setLoadingList(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadPromotions();
  }, [loadPromotions]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!videoFile) {
      setVideoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const previewTitle = promotionTitle.trim() || messageText.trim().slice(0, 80) || 'Promoção';
  const previewCaption = messageText.trim();
  const displayImagePreview = imagePreview || (needsImage ? existingMediaUrl : null);
  const displayVideoPreview = videoPreviewUrl || (needsVideo ? existingMediaUrl : null);

  const showPreview = useMemo(
    () =>
      Boolean(
        promotionTitle.trim() || messageText.trim() || displayImagePreview || displayVideoPreview
      ),
    [promotionTitle, messageText, displayImagePreview, displayVideoPreview]
  );

  const showPreviewCaption =
    previewCaption &&
    (contentType === 'text_image' || contentType === 'image' || contentType === 'video');

  const validationError = useMemo(() => {
    if (needsText && !messageText.trim()) return 'Informe o texto da promoção.';
    if (needsImage && !imageFile && !existingMediaUrl) return 'Selecione uma imagem.';
    if (needsVideo && !videoFile && !existingMediaUrl) return 'Selecione um vídeo.';
    if (!procedureId) return 'Vincule a promoção a um procedimento.';
    if (maxParticipants.trim()) {
      const n = Number(maxParticipants);
      if (!Number.isInteger(n) || n < 1) return 'Informe um limite válido (número inteiro maior que zero).';
    }
    return null;
  }, [
    needsText,
    needsImage,
    needsVideo,
    messageText,
    imageFile,
    videoFile,
    existingMediaUrl,
    procedureId,
    maxParticipants,
  ]);

  const resetFormState = () => {
    setForm(emptyForm());
    setImageFile(null);
    setVideoFile(null);
    setVideoPreviewName(null);
    setExistingMediaUrl(null);
    setEditingId(null);
  };

  const openCreateDialog = () => {
    resetFormState();
    setFormOpen(true);
  };

  const openEditDialog = (row: WhatsappPromotionRow) => {
    setEditingId(row.id);
    setForm({
      contentType: row.content_type,
      promotionTitle: row.title || '',
      messageText: row.message_text || '',
      detailsText: row.details_text || '',
      maxParticipants: row.max_participants != null ? String(row.max_participants) : '',
      menuEnabled: row.menu_enabled !== false,
      procedureId: row.procedure_id || '',
    });
    setImageFile(null);
    setVideoFile(null);
    setVideoPreviewName(null);
    setExistingMediaUrl(row.media_url || null);
    setFormOpen(true);
  };

  const closeFormDialog = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      resetFormState();
      setConfirmSendOpen(false);
    }
  };

  const resetMediaOnTypeChange = (next: WhatsappPromotionContentType) => {
    setForm((prev) => ({ ...prev, contentType: next }));
    if (next !== 'text_image' && next !== 'image') {
      setImageFile(null);
    }
    if (next !== 'video') {
      setVideoFile(null);
      setVideoPreviewName(null);
    }
    if (next === 'text') {
      setExistingMediaUrl(null);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    e.target.value = '';
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoPreviewName(file.name);
    e.target.value = '';
  };

  const uploadMediaIfNeeded = async () => {
    if (!profile?.id) throw new Error('Profissional não encontrado');
    let mediaUrl = existingMediaUrl || '';
    let mediaStoragePath = '';
    let mediaMimeType = '';

    if (needsImage && imageFile) {
      const uploaded = await uploadPromotionMedia({
        professionalId: profile.id,
        file: imageFile,
        kind: 'image',
      });
      mediaUrl = uploaded.publicUrl;
      mediaStoragePath = uploaded.storagePath;
      mediaMimeType = uploaded.mimeType;
    }

    if (needsVideo && videoFile) {
      const uploaded = await uploadPromotionMedia({
        professionalId: profile.id,
        file: videoFile,
        kind: 'video',
      });
      mediaUrl = uploaded.publicUrl;
      mediaStoragePath = uploaded.storagePath;
      mediaMimeType = uploaded.mimeType;
    }

    if (contentType === 'text') {
      mediaUrl = '';
      mediaStoragePath = '';
      mediaMimeType = '';
    }

    return { mediaUrl, mediaStoragePath, mediaMimeType };
  };

  const handleSend = async () => {
    if (!profile?.id || validationError) {
      toast.error(validationError || 'Preencha os campos da promoção.');
      return;
    }

    setSending(true);
    setConfirmSendOpen(false);
    try {
      const { mediaUrl, mediaStoragePath, mediaMimeType } = await uploadMediaIfNeeded();
      const parsedMax = maxParticipants.trim() ? Number(maxParticipants) : null;

      const result = await broadcastWhatsappPromotion({
        professionalId: profile.id,
        contentType,
        title: promotionTitle.trim() || messageText.trim().slice(0, 80),
        messageText: messageText.trim(),
        detailsText: detailsText.trim(),
        mediaUrl,
        mediaStoragePath,
        mediaMimeType,
        maxParticipants: parsedMax,
        menuEnabled,
        procedureId: procedureId || null,
      });

      if (!result.ok) {
        toast.error(result.error || 'Não foi possível enviar a promoção.');
        return;
      }

      const summary = result.summary;
      if (summary && summary.sent > 0) {
        toast.success(result.message || `Promoção enviada para ${summary.sent} paciente(s).`, {
          description:
            summary.failed > 0 ? `${summary.failed} falha(s) no envio.` : 'Todos os envios concluídos.',
        });
      } else {
        toast.message(result.message || 'Nenhum paciente recebeu a promoção.');
      }

      closeFormDialog(false);
      void loadPromotions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar promoção.');
    } finally {
      setSending(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!profile?.id || !editingId || validationError) {
      toast.error(validationError || 'Preencha os campos da promoção.');
      return;
    }

    setSavingEdit(true);
    try {
      const { mediaUrl, mediaStoragePath, mediaMimeType } = await uploadMediaIfNeeded();
      const parsedMax = maxParticipants.trim() ? Number(maxParticipants) : null;

      await updateWhatsappPromotion(profile.id, editingId, {
        title: promotionTitle.trim() || messageText.trim().slice(0, 80),
        messageText: messageText.trim(),
        detailsText: detailsText.trim(),
        contentType,
        mediaUrl: mediaUrl || null,
        mediaStoragePath: mediaStoragePath || null,
        mediaMimeType: mediaMimeType || null,
        maxParticipants: parsedMax,
        menuEnabled,
        procedureId: procedureId || null,
        status: menuEnabled ? 'active' : undefined,
      });

      toast.success('Promoção atualizada.');
      closeFormDialog(false);
      void loadPromotions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar promoção.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggle = async (row: WhatsappPromotionRow, next: boolean) => {
    if (!profile?.id) return;
    setTogglingId(row.id);
    try {
      await setWhatsappPromotionMenuEnabled(profile.id, row.id, next);
      setPromotions((prev) =>
        prev.map((p) =>
          p.id === row.id
            ? { ...p, menu_enabled: next, status: next ? 'active' : p.status }
            : p
        )
      );
      toast.success(next ? 'Promoção ativada no menu do bot.' : 'Promoção desativada no menu do bot.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível atualizar a promoção.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!profile?.id || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWhatsappPromotion(profile.id, deleteTarget.id);
      toast.success('Promoção excluída.');
      setDeleteTarget(null);
      void loadPromotions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir a promoção.');
    } finally {
      setDeleting(false);
    }
  };

  if (!showPromotions && !showHistory) return null;

  const formBusy = sending || savingEdit;

  const formFields = (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label>Tipo de conteúdo</Label>
        <RadioGroup
          value={contentType}
          onValueChange={(v) => resetMediaOnTypeChange(v as WhatsappPromotionContentType)}
          className="grid gap-2 sm:grid-cols-2"
        >
          {CONTENT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={[
                'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors',
                contentType === opt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border/70 hover:bg-muted/30',
                formBusy ? 'opacity-60 pointer-events-none' : '',
              ].join(' ')}
            >
              <RadioGroupItem value={opt.value} className="mt-0.5" />
              <span className="min-w-0">
                <span className="text-sm font-medium block">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.hint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="promo-title">Nome da promoção (menu do bot)</Label>
        <Input
          id="promo-title"
          value={promotionTitle}
          onChange={(e) => setForm((prev) => ({ ...prev, promotionTitle: e.target.value }))}
          placeholder="Ex.: Botox com 20% off"
          disabled={formBusy}
        />
        <p className="text-xs text-muted-foreground">
          Aparece na opção &quot;Ver promoções&quot; do menu da Secretária.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="promo-procedure">Procedimento vinculado</Label>
        <Select
          value={procedureId || undefined}
          onValueChange={(v) => setForm((prev) => ({ ...prev, procedureId: v }))}
          disabled={formBusy}
        >
          <SelectTrigger id="promo-procedure">
            <SelectValue placeholder="Selecione o procedimento da promoção" />
          </SelectTrigger>
          <SelectContent>
            {procedures.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                Nenhum procedimento disponível para este perfil.
              </div>
            ) : (
              procedures.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.category ? ` (${p.category})` : ''}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          No bot, ao agendar com esta promoção o paciente vai direto para a escolha de data — sem
          listar todos os procedimentos.
        </p>
      </div>

      {(needsText || optionalCaption) && (
        <div className="space-y-2">
          <Label htmlFor="promo-text">
            {needsText ? 'Texto resumido da promoção' : 'Legenda (opcional)'}
          </Label>
          <Textarea
            id="promo-text"
            value={messageText}
            onChange={(e) => setForm((prev) => ({ ...prev, messageText: e.target.value }))}
            placeholder={
              needsText
                ? 'Resumo curto exibido na lista do bot (ex.: 20% off em harmonização)...'
                : 'Texto que acompanha a mídia (opcional)'
            }
            rows={4}
            disabled={formBusy}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="promo-details">Detalhes completos (opcional)</Label>
        <Textarea
          id="promo-details"
          value={detailsText}
          onChange={(e) => setForm((prev) => ({ ...prev, detailsText: e.target.value }))}
          placeholder='Texto completo exibido quando o paciente escolher "Ver detalhes" no menu do bot.'
          rows={5}
          disabled={formBusy}
        />
        <p className="text-xs text-muted-foreground">
          Se vazio, o bot usa o texto resumido ou a mídia da promoção.
        </p>
      </div>

      {needsImage && (
        <div className="space-y-2">
          <Label>Imagem</Label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="sr-only"
              id="promo-image"
              onChange={handleImageSelect}
              disabled={formBusy}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => document.getElementById('promo-image')?.click()}
              disabled={formBusy}
            >
              <Upload className="w-4 h-4" />
              {imageFile || existingMediaUrl ? 'Trocar imagem' : 'Enviar imagem'}
            </Button>
            {imageFile ? (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{imageFile.name}</span>
            ) : existingMediaUrl ? (
              <span className="text-xs text-muted-foreground">Imagem atual mantida</span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5" />
            JPEG, PNG, GIF ou WebP
          </p>
        </div>
      )}

      {needsVideo && (
        <div className="space-y-2">
          <Label>Vídeo</Label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="sr-only"
              id="promo-video"
              onChange={handleVideoSelect}
              disabled={formBusy}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => document.getElementById('promo-video')?.click()}
              disabled={formBusy}
            >
              <Upload className="w-4 h-4" />
              {videoFile || existingMediaUrl ? 'Trocar vídeo' : 'Enviar vídeo'}
            </Button>
            {videoPreviewName ? (
              <span className="text-xs text-muted-foreground truncate max-w-[220px]">{videoPreviewName}</span>
            ) : existingMediaUrl ? (
              <span className="text-xs text-muted-foreground">Vídeo atual mantido</span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Film className="w-3.5 h-3.5" />
            MP4, MOV ou WebM (até 50 MB)
          </p>
        </div>
      )}

      {showPreview ? (
        <div className="space-y-2">
          <Label>Prévia no WhatsApp</Label>
          <div className="rounded-xl border border-border/70 overflow-hidden bg-[#efeae2] dark:bg-[#0b141a]">
            <div className="px-3 py-2 border-b border-black/5 dark:border-white/10 bg-[#075e54] text-white text-xs font-medium">
              Secretária · como o paciente verá
            </div>
            <div className="p-4 min-h-[120px]">
              <div className="max-w-[300px] ml-1">
                <div className="rounded-lg rounded-tl-none bg-white dark:bg-[#1f2c34] shadow-sm overflow-hidden text-[#111b21] dark:text-[#e9edef]">
                  {displayImagePreview && (contentType === 'text_image' || contentType === 'image') ? (
                    <img
                      src={displayImagePreview}
                      alt="Prévia da promoção"
                      className="w-full h-auto max-h-56 object-cover"
                    />
                  ) : null}

                  {displayVideoPreview && contentType === 'video' ? (
                    <video src={displayVideoPreview} controls className="w-full h-auto max-h-56 bg-black" />
                  ) : null}

                  {contentType === 'text' && previewCaption ? (
                    <p className="px-3 py-2.5 text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {previewCaption}
                    </p>
                  ) : showPreviewCaption ? (
                    <p className="px-3 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed border-t border-black/5 dark:border-white/10">
                      {previewCaption}
                    </p>
                  ) : null}

                  {!previewCaption && !displayImagePreview && !displayVideoPreview ? (
                    <p className="px-3 py-2.5 text-sm text-muted-foreground italic">
                      Preencha o conteúdo da promoção...
                    </p>
                  ) : null}

                  <div className="px-3 pb-1.5 flex justify-end">
                    <span className="text-[10px] text-[#667781]">12:00</span>
                  </div>
                </div>
              </div>

              {menuEnabled && previewTitle ? (
                <p className="mt-3 text-xs text-[#667781] dark:text-[#8696a0]">
                  No menu do bot: <span className="font-medium text-foreground">{previewTitle}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!isEditing ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          O envio é feito apenas para <strong>pacientes da aba Pacientes</strong> (cadastro completo).
          Futuros clientes e pré-cadastros são ignorados. Pode levar alguns minutos conforme a quantidade
          de contatos.
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="promo-limit">Limite de agendamentos (opcional)</Label>
        <Input
          id="promo-limit"
          type="number"
          min={1}
          inputMode="numeric"
          value={maxParticipants}
          onChange={(e) => setForm((prev) => ({ ...prev, maxParticipants: e.target.value }))}
          placeholder="Ex.: 10 — deixe vazio para ilimitado"
          disabled={formBusy}
        />
        <p className="text-xs text-muted-foreground">
          Todos recebem o aviso da promoção. O limite vale só para os primeiros que{' '}
          <strong>agendarem pelo bot</strong>. Depois disso: &quot;Poxa, acabou a promoção 😔&quot;.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Exibir no menu do bot</p>
          <p className="text-xs text-muted-foreground">
            Desligado: a promoção não aparece no menu do bot
            {!isEditing ? ' (só no envio em massa, se você disparar)' : ''}.
          </p>
        </div>
        <Switch
          checked={menuEnabled}
          onCheckedChange={(v) => setForm((prev) => ({ ...prev, menuEnabled: v }))}
          disabled={formBusy}
        />
      </div>
    </div>
  );

  return (
    <>
      {showPromotions ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
            <div className="space-y-1.5 min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 shrink-0" />
                Promoções automáticas
              </CardTitle>
              <CardDescription>
                Cadastre promoções, ative no menu do bot e envie em massa para os pacientes.
              </CardDescription>
            </div>
            <Button type="button" className="gap-2 shrink-0" onClick={openCreateDialog}>
              <Plus className="w-4 h-4" />
              Cadastrar uma nova promoção
            </Button>
          </CardHeader>
          <CardContent>
            {loadingList ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando promoções...
              </div>
            ) : promotions.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-8 text-center space-y-3">
                <Megaphone className="w-8 h-8 mx-auto text-muted-foreground/70" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Nenhuma promoção cadastrada</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Clique em &quot;Cadastrar uma nova promoção&quot; para criar, disponibilizar no menu do
                    bot e enviar aos pacientes.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={openCreateDialog}>
                  <Plus className="w-4 h-4" />
                  Cadastrar uma nova promoção
                </Button>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {promotions.map((row) => {
                  const title = row.title?.trim() || contentTypeLabel(row.content_type);
                  const active = row.menu_enabled !== false;
                  const procedureName =
                    procedures.find((p) => p.id === row.procedure_id)?.name ||
                    (row.procedure_id ? 'Procedimento vinculado' : 'Sem procedimento');
                  return (
                    <li
                      key={row.id}
                      className="rounded-xl border border-border/70 bg-card/60 p-3 sm:p-4 space-y-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold leading-snug truncate" title={title}>
                          {title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {contentTypeLabel(row.content_type)} · {formatDateBR(row.created_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Procedimento: <span className="font-medium text-foreground">{procedureName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {row.message_text || (row.media_url ? 'Mídia sem texto' : '—')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Agendamentos: {row.claimed_count}
                          {row.max_participants != null ? `/${row.max_participants}` : ' (ilimitado)'}
                          {showHistory
                            ? ` · Enviado: ${row.sent_count}/${row.total_recipients}`
                            : null}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Ativa no menu</p>
                          <p className="text-xs text-muted-foreground">
                            {active ? 'Visível no bot' : 'Oculta no bot'}
                          </p>
                        </div>
                        <Switch
                          checked={active}
                          disabled={togglingId === row.id}
                          onCheckedChange={(v) => void handleToggle(row, v)}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openEditDialog(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : showHistory ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos envios</CardTitle>
            <CardDescription>Histórico recente de promoções disparadas.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingList ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : promotions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma promoção enviada ainda.</p>
            ) : (
              <ul className="space-y-2">
                {promotions.map((row) => (
                  <li key={row.id} className="rounded-lg border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{row.title || contentTypeLabel(row.content_type)}</span>
                      <span className="text-xs text-muted-foreground">{formatDateBR(row.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {row.message_text || (row.media_url ? 'Mídia sem texto' : '—')}
                    </p>
                    <p className="text-xs mt-1">
                      Enviado em massa: {row.sent_count}/{row.total_recipients}
                      {row.failed_count > 0 ? ` · ${row.failed_count} falha(s)` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={formOpen} onOpenChange={closeFormDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar promoção' : 'Cadastrar uma nova promoção'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Atualize os dados da promoção. A alteração vale para o menu do bot.'
                : 'Preencha os dados, disponibilize no menu do bot e envie em massa aos pacientes.'}
            </DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={formBusy} onClick={() => closeFormDialog(false)}>
              Cancelar
            </Button>
            {isEditing ? (
              <Button
                type="button"
                disabled={formBusy || Boolean(validationError)}
                onClick={() => void handleSaveEdit()}
                className="gap-2"
              >
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                {savingEdit ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={formBusy || Boolean(validationError)}
                onClick={() => setConfirmSendOpen(true)}
                className="gap-2"
              >
                <Megaphone className="w-4 h-4" />
                {sending ? 'Enviando...' : 'Cadastrar e enviar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio da promoção?</AlertDialogTitle>
            <AlertDialogDescription>
              A promoção será cadastrada
              {menuEnabled ? ' e ficará disponível no menu do bot' : ''}
              {maxParticipants.trim() ? ` (limite de ${maxParticipants} agendamento(s))` : ''}. O envio
              em massa vai para pacientes da aba Pacientes com telefone. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={sending} onClick={() => void handleSend()}>
              Confirmar envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir promoção?</AlertDialogTitle>
            <AlertDialogDescription>
              A promoção &quot;{deleteTarget?.title?.trim() || 'sem nome'}&quot; será removida do histórico e
              do menu do bot. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
