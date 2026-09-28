import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { clinicPatientOriginsKey } from '@/hooks/use-clinic-patient-origins';
import {
  createClinicPatientOrigin,
  deleteClinicPatientOrigin,
  fetchClinicPatientOrigins,
  updateClinicPatientOrigin,
  type ClinicPatientOrigin,
} from '@/services/api/clinicPatientOriginsApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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

export default function SettingsClinicOrigins() {
  const { isMaster, isClinicAccount, organizationId, isLoading: masterLoading } = useClinicMaster();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: clinicPatientOriginsKey(organizationId, false),
    enabled: Boolean(isMaster && organizationId),
    queryFn: () => fetchClinicPatientOrigins(),
  });

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ClinicPatientOrigin | null>(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ClinicPatientOrigin | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const origins = listQuery.data ?? [];

  if (!masterLoading && (!isClinicAccount || !isMaster)) {
    return <Navigate to="/settings" replace />;
  }

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['clinic-patient-origins'] });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!organizationId) {
      toast.error('Organização da clínica não encontrada.');
      return;
    }
    setSaving(true);
    try {
      await createClinicPatientOrigin({ organizationId, name });
      setName('');
      toast.success('Origem cadastrada.');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao cadastrar origem.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await updateClinicPatientOrigin({ id: editing.id, name: editName });
      toast.success('Origem atualizada.');
      setEditing(null);
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar origem.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggle(origin: ClinicPatientOrigin, isActive: boolean) {
    setTogglingId(origin.id);
    try {
      await updateClinicPatientOrigin({ id: origin.id, is_active: isActive });
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar origem.');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await deleteClinicPatientOrigin(confirmDelete.id);
      toast.success('Origem excluída.');
      setConfirmDelete(null);
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir origem.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Share2 className="h-6 w-6 text-primary" />
          Origens
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Cadastre as origens que a recepção seleciona no paciente (Instagram, indicação, Google,
          convênio…). Se cadastrar uma origem chamada <strong>Indicação</strong>, o cadastro do
          paciente passa a mostrar o campo opcional Indicado por.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nova origem</CardTitle>
          <CardDescription>O nome aparece no seletor do cadastro de pacientes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2 flex-1 min-w-0">
              <Label htmlFor="origin-name">Nome</Label>
              <Input
                id="origin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Instagram, Indicação, Google"
                maxLength={80}
              />
            </div>
            <Button type="submit" className="gap-2 shrink-0" disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Cadastrar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Origens da clínica</CardTitle>
          <CardDescription>
            Origens inativas deixam de aparecer no cadastro, mas permanecem na ficha de quem já
            usou.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading || masterLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          ) : listQuery.isError ? (
            <p className="text-sm text-destructive py-4">
              {listQuery.error instanceof Error
                ? listQuery.error.message
                : 'Erro ao carregar origens.'}
            </p>
          ) : origins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma origem cadastrada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[140px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {origins.map((origin) => (
                    <TableRow key={origin.id}>
                      <TableCell className="font-medium">{origin.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={origin.is_active}
                            disabled={togglingId === origin.id}
                            onCheckedChange={(checked) => void handleToggle(origin, checked === true)}
                          />
                          <Badge variant={origin.is_active ? 'secondary' : 'outline'}>
                            {origin.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(origin);
                              setEditName(origin.name);
                            }}
                            aria-label={`Editar ${origin.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDelete(origin)}
                            aria-label={`Excluir ${origin.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
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

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar origem</DialogTitle>
            <DialogDescription>O novo nome vale para os próximos cadastros e para a ficha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-origin-name">Nome</Label>
            <Input
              id="edit-origin-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSaveEdit()} disabled={savingEdit || !editName.trim()}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir origem?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete
                ? `“${confirmDelete.name}” sai da lista. Pacientes que já usavam esta origem ficam sem origem vinculada.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={Boolean(deletingId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
