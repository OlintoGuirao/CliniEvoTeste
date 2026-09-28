import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { clinicRecordTypesKey } from '@/hooks/use-clinic-record-types';
import {
  createClinicRecordType,
  deleteClinicRecordType,
  fetchClinicRecordTypes,
  updateClinicRecordType,
  type ClinicRecordType,
} from '@/services/api/clinicRecordTypesApi';
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

export default function SettingsClinicRecordTypes() {
  const { isMaster, isClinicAccount, organizationId, isLoading: masterLoading } = useClinicMaster();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: clinicRecordTypesKey(organizationId, false),
    enabled: Boolean(isMaster && organizationId),
    queryFn: () => fetchClinicRecordTypes(),
  });

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ClinicRecordType | null>(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ClinicRecordType | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const recordTypes = listQuery.data ?? [];

  if (!masterLoading && (!isClinicAccount || !isMaster)) {
    return <Navigate to="/settings" replace />;
  }

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['clinic-record-types'] });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!organizationId) {
      toast.error('Organização da clínica não encontrada.');
      return;
    }
    setSaving(true);
    try {
      await createClinicRecordType({ organizationId, name });
      setName('');
      toast.success('Tipo de ficha cadastrado.');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao cadastrar tipo de ficha.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await updateClinicRecordType({ id: editing.id, name: editName });
      toast.success('Tipo de ficha atualizado.');
      setEditing(null);
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar tipo de ficha.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggle(recordType: ClinicRecordType, isActive: boolean) {
    setTogglingId(recordType.id);
    try {
      await updateClinicRecordType({ id: recordType.id, is_active: isActive });
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar tipo de ficha.');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await deleteClinicRecordType(confirmDelete.id);
      toast.success('Tipo de ficha excluído.');
      setConfirmDelete(null);
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir tipo de ficha.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          Tipos de ficha
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Cadastre os tipos de ficha que a recepção pode marcar no paciente (HOF, Anamnese HOF,
          Odonto, Médico…). Cada paciente pode ter um ou mais tipos.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Novo tipo de ficha</CardTitle>
          <CardDescription>O nome aparece nas opções do cadastro de pacientes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2 flex-1 min-w-0">
              <Label htmlFor="record-type-name">Nome</Label>
              <Input
                id="record-type-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: HOF, Anamnese HOF, Odonto, Médico"
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
          <CardTitle className="text-base">Tipos da clínica</CardTitle>
          <CardDescription>
            Tipos inativos deixam de aparecer no cadastro, mas permanecem na ficha de quem já
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
                : 'Erro ao carregar tipos de ficha.'}
            </p>
          ) : recordTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum tipo de ficha cadastrado ainda.
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
                  {recordTypes.map((recordType) => (
                    <TableRow key={recordType.id}>
                      <TableCell className="font-medium">{recordType.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={recordType.is_active}
                            disabled={togglingId === recordType.id}
                            onCheckedChange={(checked) => void handleToggle(recordType, checked === true)}
                          />
                          <Badge variant={recordType.is_active ? 'secondary' : 'outline'}>
                            {recordType.is_active ? 'Ativo' : 'Inativo'}
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
                              setEditing(recordType);
                              setEditName(recordType.name);
                            }}
                            aria-label={`Editar ${recordType.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDelete(recordType)}
                            aria-label={`Excluir ${recordType.name}`}
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
            <DialogTitle>Editar tipo de ficha</DialogTitle>
            <DialogDescription>O novo nome vale para os próximos cadastros e para a ficha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-record-type-name">Nome</Label>
            <Input
              id="edit-record-type-name"
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
            <AlertDialogTitle>Excluir tipo de ficha?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete
                ? `“${confirmDelete.name}” sai da lista e deixa de aparecer nas fichas dos pacientes que já usavam este tipo.`
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
