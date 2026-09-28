import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSalonAccount } from '@/hooks/use-salon-account';
import {
  createSalonProcedure,
  deactivateSalonProcedure,
  fetchSalonProcedures,
  updateSalonProcedure,
  type SalonProcedure,
} from '@/services/api/salonProceduresApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Pencil, Plus, Scissors, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Draft = { name: string; description: string };

const emptyDraft = (): Draft => ({ name: '', description: '' });

export default function SettingsSalonProcedures() {
  const { isSalonAccount, isSalonAdmin, isLoading: salonLoading } = useSalonAccount();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['salon-procedures'],
    enabled: Boolean(isSalonAdmin),
    queryFn: fetchSalonProcedures,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SalonProcedure | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const rows = useMemo(
    () => (listQuery.data ?? []).filter((r) => r.is_active),
    [listQuery.data]
  );

  if (!salonLoading && (!isSalonAccount || !isSalonAdmin)) {
    return <Navigate to="/settings" replace />;
  }

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setDialogOpen(true);
  };

  const openEdit = (row: SalonProcedure) => {
    setEditing(row);
    setDraft({ name: row.name, description: row.description ?? '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = draft.name.trim();
    if (name.length < 2) {
      toast.error('Informe o nome do procedimento.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateSalonProcedure(editing.id, {
          name,
          description: draft.description.trim() || null,
        });
        toast.success('Procedimento atualizado.');
      } else {
        await createSalonProcedure({
          name,
          description: draft.description.trim() || null,
        });
        toast.success('Procedimento cadastrado.');
      }
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['salon-procedures'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      await deactivateSalonProcedure(id);
      toast.success('Procedimento removido.');
      await queryClient.invalidateQueries({ queryKey: ['salon-procedures'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Scissors className="h-6 w-6 text-primary" />
            Cadastrar procedimentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Cadastre os serviços do salão com nome e descrição.
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo procedimento
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Procedimentos do salão</CardTitle>
          <CardDescription>Lista dos serviços disponíveis para a equipe.</CardDescription>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading || salonLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          ) : listQuery.isError ? (
            <p className="text-sm text-destructive py-4">
              {listQuery.error instanceof Error
                ? listQuery.error.message
                : 'Erro ao carregar procedimentos.'}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum procedimento cadastrado. Clique em Novo procedimento.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-md">
                        {row.description?.trim() || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={removingId === row.id}
                            onClick={() => void handleRemove(row.id)}
                          >
                            {removingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar procedimento' : 'Novo procedimento'}
            </DialogTitle>
            <DialogDescription>Preencha o nome e, se quiser, uma descrição.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="salon-proc-name">Nome *</Label>
              <Input
                id="salon-proc-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Ex.: Corte feminino"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salon-proc-desc">Descrição</Label>
              <Textarea
                id="salon-proc-desc"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Detalhes opcionais do serviço"
                rows={4}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
