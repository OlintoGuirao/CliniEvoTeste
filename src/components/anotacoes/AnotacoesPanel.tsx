import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  anotacaoContentPreview,
  createAnotacao,
  deleteAnotacao,
  fetchAnotacoes,
  updateAnotacao,
  type AnotacaoRow,
} from '@/lib/anotacoes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

function formatAnotacaoDate(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function AnotacoesPanel() {
  const { profile } = useAuth();
  const professionalId = profile?.id ?? '';

  const [anotacoes, setAnotacoes] = useState<AnotacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [detailContent, setDetailContent] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createContent, setCreateContent] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AnotacaoRow | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const selectedNote = useMemo(
    () => anotacoes.find((n) => n.id === selectedNoteId) ?? null,
    [anotacoes, selectedNoteId]
  );

  const refresh = useCallback(async () => {
    if (!professionalId) return;
    const rows = await fetchAnotacoes(professionalId);
    setAnotacoes(rows);
  }, [professionalId]);

  useEffect(() => {
    if (!professionalId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = await fetchAnotacoes(professionalId);
        if (!cancelled) setAnotacoes(rows);
      } catch {
        if (!cancelled) toast.error('Não foi possível carregar as anotações.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [professionalId]);

  useEffect(() => {
    if (!selectedNote) {
      setDetailContent('');
      return;
    }
    setDetailContent(selectedNote.content);
  }, [selectedNote?.id, selectedNote?.content]);

  const openCreateDialog = () => {
    setCreateTitle('');
    setCreateContent('');
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!professionalId) return;
    const title = createTitle.trim();
    if (!title) {
      toast.error('Informe um título para a anotação.');
      return;
    }
    setSavingCreate(true);
    try {
      const created = await createAnotacao({
        professionalId,
        title,
        content: createContent,
      });
      await refresh();
      setCreateDialogOpen(false);
      setSelectedNoteId(created.id);
      toast.success('Anotação criada.');
    } catch {
      toast.error('Não foi possível criar a anotação.');
    } finally {
      setSavingCreate(false);
    }
  };

  const handleSaveDetail = async () => {
    if (!selectedNote) return;
    setSavingDetail(true);
    try {
      const updated = await updateAnotacao(selectedNote.id, { content: detailContent });
      setAnotacoes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      toast.success('Anotação salva.');
    } catch {
      toast.error('Não foi possível salvar a anotação.');
    } finally {
      setSavingDetail(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingNoteId(deleteTarget.id);
    try {
      await deleteAnotacao(deleteTarget.id);
      if (selectedNoteId === deleteTarget.id) setSelectedNoteId('');
      setAnotacoes((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      toast.success('Anotação excluída.');
    } catch {
      toast.error('Não foi possível excluir a anotação.');
    } finally {
      setDeletingNoteId(null);
      setDeleteTarget(null);
    }
  };

  const detailDirty = selectedNote != null && detailContent !== selectedNote.content;

  return (
    <div className="min-w-0 space-y-4">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="pb-2 space-y-3 lg:space-y-0">
          <div className="flex flex-col gap-3 min-w-0 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              {selectedNote ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 mt-0.5"
                  onClick={() => setSelectedNoteId('')}
                  title="Voltar às anotações"
                  aria-label="Voltar às anotações"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              ) : null}
              <div className="min-w-0">
                <CardTitle className="text-base lg:text-xl break-words pr-1">
                  {selectedNote ? selectedNote.title : 'Anotações'}
                </CardTitle>
                <p className="text-xs lg:text-sm text-muted-foreground mt-1 break-words">
                  {selectedNote
                    ? `Última atualização: ${formatAnotacaoDate(selectedNote.updated_at)}`
                    : 'Blocos de anotações para organizar informações do dia a dia.'}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 w-full lg:w-auto lg:shrink-0">
              {!selectedNote ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={openCreateDialog}
                  className="h-10 w-full lg:w-auto shrink-0"
                >
                  <Plus className="h-4 w-4 mr-2 shrink-0" />
                  Adicionar anotações
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSaveDetail}
                  disabled={savingDetail || !detailDirty}
                  className="h-10 w-full lg:w-auto shrink-0"
                >
                  {savingDetail ? 'Salvando…' : 'Salvar anotação'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6">Carregando…</p>
          ) : selectedNote ? (
            <div className="space-y-3">
              <Textarea
                value={detailContent}
                onChange={(e) => setDetailContent(e.target.value)}
                placeholder="Escreva suas anotações aqui…"
                className="min-h-[min(60vh,480px)] rounded-2xl resize-y text-sm leading-relaxed"
                aria-label="Conteúdo da anotação"
              />
              <p className="text-xs text-muted-foreground">
                Continue escrevendo no final do texto e clique em &quot;Salvar anotação&quot; quando terminar.
              </p>
            </div>
          ) : anotacoes.length === 0 ? (
            <div className="py-6 space-y-3 max-w-full">
              <p className="text-sm text-muted-foreground break-words">Nenhuma anotação criada ainda.</p>
              <Button type="button" variant="outline" onClick={openCreateDialog} className="w-full lg:w-auto">
                <Plus className="h-4 w-4 mr-2 shrink-0" />
                Criar primeira anotação
              </Button>
            </div>
          ) : (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {anotacoes.map((note) => {
                const preview = anotacaoContentPreview(note.content);
                return (
                  <Card
                    key={note.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Abrir anotação: ${note.title}`}
                    className={cn(
                      'group relative overflow-hidden rounded-2xl border-border/60 bg-card text-left',
                      'shadow-sm transition-all duration-200',
                      'cursor-pointer',
                      'hover:border-primary/30 hover:shadow-md hover:bg-accent/25',
                      'active:scale-[0.99] active:shadow-sm',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                    )}
                    onClick={() => setSelectedNoteId(note.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedNoteId(note.id);
                      }
                    }}
                  >
                    <div
                      className="h-1.5 w-full bg-gradient-to-r from-primary/80 via-primary/50 to-primary/25"
                      aria-hidden
                    />
                    <CardHeader className="space-y-3 pb-0 pt-4 min-w-0 sm:pt-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/90">
                            Anotação
                          </p>
                          <CardTitle className="mt-1 text-lg font-semibold leading-snug tracking-tight break-words sm:text-xl">
                            {note.title}
                          </CardTitle>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Excluir anotação"
                            aria-label={`Excluir anotação ${note.title}`}
                            disabled={deletingNoteId === note.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(note);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-muted-foreground transition-colors group-hover:border-primary/25 group-hover:bg-primary/10 group-hover:text-primary">
                            <ChevronRight
                              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                              aria-hidden
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2 text-xs text-muted-foreground ring-1 ring-border/40">
                          <StickyNote className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
                          <span className="break-words leading-snug">
                            Atualizado em {formatAnotacaoDate(note.updated_at)}
                          </span>
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4 pt-4">
                      <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-gradient-to-br from-muted/40 to-muted/20 px-4 py-3 shadow-inner min-h-[4.5rem]">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm ring-1 ring-primary/10"
                          aria-hidden
                        >
                          <FileText className="h-6 w-6" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-foreground/90 line-clamp-3">{preview}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova anotação</DialogTitle>
            <DialogDescription>
              Defina um título e comece a escrever. Você pode continuar editando depois de salvar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="anotacao-title">Título</Label>
              <Input
                id="anotacao-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Ex.: Ideias para campanha, Lista de compras…"
                className="rounded-xl"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anotacao-content">Anotações</Label>
              <Textarea
                id="anotacao-content"
                value={createContent}
                onChange={(e) => setCreateContent(e.target.value)}
                placeholder="Escreva aqui…"
                className="min-h-[200px] rounded-2xl resize-y"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreate} disabled={savingCreate}>
              {savingCreate ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anotação?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `A anotação "${deleteTarget.title}" será removida permanentemente.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingNoteId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={!!deletingNoteId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingNoteId ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
