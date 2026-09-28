import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  Loader2,
  Pencil,
  Plus,
  Scissors,
  Trash2,
  CalendarOff,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
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
import { isDepilacaoLaserModuleEnabled } from '@/lib/professionalModules';
import {
  createLaserEquipment,
  createLaserUnavailablePeriod,
  deleteLaserEquipment,
  deleteLaserUnavailablePeriod,
  ensureDepilacaoLaserProcedureAvailable,
  fetchLaserEquipments,
  fetchLaserTreatments,
  fetchLaserUnavailablePeriods,
  formatLaserPeriodRange,
  LASER_REASON_LABELS,
  laserBlockLabel,
  updateLaserEquipment,
  type LaserEquipment,
  type LaserUnavailablePeriod,
  type LaserUnavailableReason,
} from '@/lib/depilacaoLaser';

export default function DepilacaoLaserPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const professionalId = profile?.id ?? '';

  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<LaserEquipment | null>(null);
  const [equipName, setEquipName] = useState('');
  const [equipBrand, setEquipBrand] = useState('');
  const [equipModel, setEquipModel] = useState('');
  const [equipSerial, setEquipSerial] = useState('');
  const [equipNotes, setEquipNotes] = useState('');
  const [savingEquip, setSavingEquip] = useState(false);
  const [deleteEquipId, setDeleteEquipId] = useState<string | null>(null);

  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [periodEquipmentId, setPeriodEquipmentId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodReason, setPeriodReason] = useState<LaserUnavailableReason>('aluguel');
  const [periodNote, setPeriodNote] = useState('');
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [deletePeriodId, setDeletePeriodId] = useState<string | null>(null);

  const equipmentsQuery = useQuery({
    queryKey: ['laser-equipments', professionalId],
    queryFn: () => fetchLaserEquipments(professionalId),
    enabled: !!professionalId,
  });

  const periodsQuery = useQuery({
    queryKey: ['laser-unavailable-periods', professionalId],
    queryFn: () => fetchLaserUnavailablePeriods(professionalId),
    enabled: !!professionalId,
  });

  const treatmentsQuery = useQuery({
    queryKey: ['laser-treatments', professionalId],
    queryFn: () => fetchLaserTreatments(professionalId),
    enabled: !!professionalId,
  });

  const procedureAccessQuery = useQuery({
    queryKey: ['laser-procedure-access', professionalId],
    queryFn: () => ensureDepilacaoLaserProcedureAvailable(professionalId),
    enabled: !!professionalId,
  });

  const procedureAvailable = procedureAccessQuery.data?.ok === true;

  const activeEquipments = useMemo(
    () => (equipmentsQuery.data ?? []).filter((e) => e.is_active),
    [equipmentsQuery.data]
  );

  const openCreateEquipment = () => {
    setEditingEquipment(null);
    setEquipName('');
    setEquipBrand('');
    setEquipModel('');
    setEquipSerial('');
    setEquipNotes('');
    setEquipmentDialogOpen(true);
  };

  const openEditEquipment = (equip: LaserEquipment) => {
    setEditingEquipment(equip);
    setEquipName(equip.name);
    setEquipBrand(equip.brand ?? '');
    setEquipModel(equip.model ?? '');
    setEquipSerial(equip.serial_number ?? '');
    setEquipNotes(equip.notes ?? '');
    setEquipmentDialogOpen(true);
  };

  const handleSaveEquipment = async () => {
    setSavingEquip(true);
    try {
      if (editingEquipment) {
        await updateLaserEquipment(editingEquipment.id, {
          name: equipName,
          brand: equipBrand,
          model: equipModel,
          serialNumber: equipSerial,
          notes: equipNotes,
        });
        toast.success('Máquina atualizada.');
      } else {
        await createLaserEquipment({
          professionalId,
          name: equipName,
          brand: equipBrand,
          model: equipModel,
          serialNumber: equipSerial,
          notes: equipNotes,
        });
        toast.success('Máquina cadastrada.');
      }
      await queryClient.invalidateQueries({ queryKey: ['laser-equipments', professionalId] });
      setEquipmentDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a máquina.');
    } finally {
      setSavingEquip(false);
    }
  };

  const handleDeleteEquipment = async () => {
    if (!deleteEquipId) return;
    try {
      await deleteLaserEquipment(deleteEquipId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['laser-equipments', professionalId] }),
        queryClient.invalidateQueries({ queryKey: ['laser-unavailable-periods', professionalId] }),
      ]);
      toast.success('Máquina removida.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover.');
    } finally {
      setDeleteEquipId(null);
    }
  };

  const openCreatePeriod = (equipmentId?: string) => {
    setPeriodEquipmentId(equipmentId || activeEquipments[0]?.id || '');
    setPeriodStart('');
    setPeriodEnd('');
    setPeriodReason('aluguel');
    setPeriodNote('');
    setPeriodDialogOpen(true);
  };

  const handleSavePeriod = async () => {
    setSavingPeriod(true);
    try {
      await createLaserUnavailablePeriod({
        professionalId,
        equipmentId: periodEquipmentId,
        startDate: periodStart,
        endDate: periodEnd || periodStart,
        reason: periodReason,
        note: periodNote,
      });
      await queryClient.invalidateQueries({ queryKey: ['laser-unavailable-periods', professionalId] });
      toast.success('Período cadastrado. A agenda será bloqueada nessas datas.');
      setPeriodDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o período.');
    } finally {
      setSavingPeriod(false);
    }
  };

  const handleDeletePeriod = async () => {
    if (!deletePeriodId) return;
    try {
      await deleteLaserUnavailablePeriod(deletePeriodId);
      await queryClient.invalidateQueries({ queryKey: ['laser-unavailable-periods', professionalId] });
      toast.success('Período removido. A agenda foi liberada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover o período.');
    } finally {
      setDeletePeriodId(null);
    }
  };

  if (!isDepilacaoLaserModuleEnabled(profile)) {
    return <Navigate to="/dashboard" replace />;
  }

  const equipments = equipmentsQuery.data ?? [];
  const periods = periodsQuery.data ?? [];
  const treatments = treatmentsQuery.data ?? [];

  return (
    <div className="min-w-0 space-y-4 md:space-y-6 animate-fade-in">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Depilação a laser' },
        ]}
        className="mb-1 hidden md:block"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scissors className="h-6 w-6 text-primary" />
            Depilação a laser
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre a máquina, bloqueie a agenda quando estiver alugada e acompanhe os tratamentos.
          </p>
        </div>
        {procedureAvailable ? (
          <Button asChild variant="outline">
            <Link to="/depilacao-laser/start">
              <Plus className="h-4 w-4 mr-2" />
              Novo tratamento
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled>
            <Plus className="h-4 w-4 mr-2" />
            Novo tratamento
          </Button>
        )}
      </div>

      {procedureAccessQuery.data && !procedureAccessQuery.data.ok ? (
        <Card className="border-amber-300 bg-amber-50/80 dark:bg-amber-950/30">
          <CardContent className="pt-4 text-sm text-amber-950 dark:text-amber-100">
            <p className="font-medium">Procedimento ainda não liberado para este perfil</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-100/80">
              {procedureAccessQuery.data.error}
            </p>
            <Button asChild variant="link" className="px-0 mt-1 h-auto">
              <Link to="/settings">Abrir Configurações → Procedimentos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="maquinas" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="maquinas">Máquinas</TabsTrigger>
          <TabsTrigger value="indisponibilidade">Indisponibilidade</TabsTrigger>
          <TabsTrigger value="tratamentos">Tratamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="maquinas" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Máquinas cadastradas</CardTitle>
                <CardDescription>Equipamentos usados nos atendimentos de depilação.</CardDescription>
              </div>
              <Button type="button" size="sm" onClick={openCreateEquipment}>
                <Plus className="h-4 w-4 mr-1" />
                Nova máquina
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {equipmentsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : equipments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma máquina cadastrada ainda.</p>
              ) : (
                equipments.map((equip) => (
                  <div
                    key={equip.id}
                    className="rounded-xl border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{equip.name}</p>
                        {!equip.is_active ? <Badge variant="secondary">Inativa</Badge> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[equip.brand, equip.model].filter(Boolean).join(' · ') || 'Sem marca/modelo'}
                      </p>
                      {equip.serial_number ? (
                        <p className="text-xs text-muted-foreground">Série: {equip.serial_number}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openCreatePeriod(equip.id)}>
                        <CalendarOff className="h-4 w-4 mr-1" />
                        Bloquear agenda
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => openEditEquipment(equip)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteEquipId(equip.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indisponibilidade" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Máquina alugada / manutenção</CardTitle>
                <CardDescription>
                  Nestes dias a agenda fica bloqueada automaticamente (como nas férias).
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => openCreatePeriod()}
                disabled={activeEquipments.length === 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                Novo período
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeEquipments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cadastre uma máquina primeiro.</p>
              ) : periodsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : periods.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum período de bloqueio cadastrado.</p>
              ) : (
                periods.map((period: LaserUnavailablePeriod) => (
                  <div
                    key={period.id}
                    className="rounded-xl border p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{laserBlockLabel(period)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatLaserPeriodRange(period.start_date, period.end_date)}
                      </p>
                      <Badge variant="outline">{LASER_REASON_LABELS[period.reason]}</Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeletePeriodId(period.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remover
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tratamentos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tratamentos em andamento</CardTitle>
              <CardDescription>
                Pacientes com depilação a laser. Abra o detalhe para registrar sessões.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {treatmentsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : treatments.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Nenhum tratamento cadastrado.</p>
                  {procedureAvailable ? (
                    <Button asChild>
                      <Link to="/depilacao-laser/start">Iniciar tratamento</Link>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Libere o procedimento no admin/permissões para iniciar tratamentos.
                    </p>
                  )}
                </div>
              ) : (
                treatments.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{t.patient_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Início{' '}
                        {(() => {
                          try {
                            return format(parseISO(t.data_inicio), 'dd/MM/yyyy');
                          } catch {
                            return t.data_inicio;
                          }
                        })()}{' '}
                        · {t.sessions_count} sessão(ões) · {t.status.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/procedures/depilacao-laser/${t.id}`}>
                        Abrir
                        <ExternalLink className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={equipmentDialogOpen} onOpenChange={setEquipmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEquipment ? 'Editar máquina' : 'Nova máquina'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={equipName} onChange={(e) => setEquipName(e.target.value)} placeholder="Ex.: Laser Alma Soprano" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={equipBrand} onChange={(e) => setEquipBrand(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input value={equipModel} onChange={(e) => setEquipModel(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Número de série</Label>
              <Input value={equipSerial} onChange={(e) => setEquipSerial(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={equipNotes} onChange={(e) => setEquipNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEquipmentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSaveEquipment()} disabled={savingEquip}>
              {savingEquip ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear agenda da máquina</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Máquina</Label>
              <Select value={periodEquipmentId} onValueChange={setPeriodEquipmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {activeEquipments.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={periodReason} onValueChange={(v) => setPeriodReason(v as LaserUnavailableReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aluguel">Alugada</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Input
                value={periodNote}
                onChange={(e) => setPeriodNote(e.target.value)}
                placeholder="Ex.: Alugada para Clínica X"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPeriodDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSavePeriod()} disabled={savingPeriod}>
              {savingPeriod ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar e bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEquipId} onOpenChange={(open) => !open && setDeleteEquipId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover máquina?</AlertDialogTitle>
            <AlertDialogDescription>
              Os períodos de indisponibilidade ligados a ela também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteEquipment();
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePeriodId} onOpenChange={(open) => !open && setDeletePeriodId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover período?</AlertDialogTitle>
            <AlertDialogDescription>A agenda volta a ficar livre nessas datas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDeletePeriod();
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
