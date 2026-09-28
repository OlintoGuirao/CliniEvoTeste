import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import {
  createClinicBranch,
  deleteClinicBranch,
  fetchClinicBranchesAdmin,
  updateClinicBranch,
  type OrganizationBranch,
} from '@/services/api/clinicBranchesApi';
import { BranchAccentColorPicker } from '@/components/clinic/BranchAccentColorPicker';
import { BranchLogoField } from '@/components/clinic/BranchLogoField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ACCENT_PRESETS } from '@/lib/theme-colors';
import type { PixKeyType } from '@/lib/cobrancaPix';
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DEFAULT_BRANCH_COLOR = ACCENT_PRESETS.find((p) => p.id === 'blue')?.hex ?? '#2563eb';

const BRANCH_DIALOG_CLASS =
  '!flex !max-h-[min(92dvh,780px)] w-[calc(100vw-1.25rem)] !max-w-2xl !flex-col !gap-0 !overflow-hidden !p-0 sm:!rounded-xl';

const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'random', label: 'Chave aleatória' },
];

type BranchCreateDraft = {
  name: string;
  address: string;
  phone: string;
  accentColor: string;
  loginFullName: string;
  loginEmail: string;
  loginPassword: string;
};

type BranchDraft = {
  name: string;
  address: string;
  phone: string;
  accent_color: string;
  logo_url: string;
  whatsapp_instance_id: string;
  pix_key: string;
  pix_key_type: PixKeyType;
  pix_receiver_name: string;
  is_active: boolean;
};

function emptyCreateDraft(): BranchCreateDraft {
  return {
    name: '',
    address: '',
    phone: '',
    accentColor: DEFAULT_BRANCH_COLOR,
    loginFullName: '',
    loginEmail: '',
    loginPassword: '',
  };
}

function emptyDraft(): BranchDraft {
  return {
    name: '',
    address: '',
    phone: '',
    accent_color: DEFAULT_BRANCH_COLOR,
    logo_url: '',
    whatsapp_instance_id: '',
    pix_key: '',
    pix_key_type: 'email',
    pix_receiver_name: '',
    is_active: true,
  };
}

function branchToDraft(b: OrganizationBranch): BranchDraft {
  return {
    name: b.name,
    address: b.address ?? '',
    phone: b.phone ?? '',
    accent_color: b.accent_color ?? DEFAULT_BRANCH_COLOR,
    logo_url: b.logo_url ?? '',
    whatsapp_instance_id: b.whatsapp_instance_id ?? '',
    pix_key: b.pix_key ?? '',
    pix_key_type: (b.pix_key_type as PixKeyType) || 'email',
    pix_receiver_name: b.pix_receiver_name ?? '',
    is_active: b.is_active,
  };
}

function BranchColorDot({ color, className }: { color: string | null | undefined; className?: string }) {
  const hex = color?.trim() || DEFAULT_BRANCH_COLOR;
  return (
    <span
      className={cn('inline-block h-3 w-3 shrink-0 rounded-full border border-border', className)}
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
}

function branchInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'FL';
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground/70 shrink-0" />
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function BranchAvatar({ branch }: { branch: OrganizationBranch }) {
  const color = branch.accent_color?.trim() || DEFAULT_BRANCH_COLOR;
  if (branch.logo_url) {
    return (
      <img
        src={branch.logo_url}
        alt=""
        className="h-10 w-10 rounded-xl border object-contain p-0.5 shrink-0 bg-background"
      />
    );
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {branchInitials(branch.name)}
    </div>
  );
}

export default function SettingsClinicBranches() {
  const { isMaster, isClinicAccount, isLoading: masterLoading } = useClinicMaster();
  const queryClient = useQueryClient();

  const branchesQuery = useQuery({
    queryKey: ['clinic-branches-admin'],
    enabled: Boolean(isMaster),
    queryFn: fetchClinicBranchesAdmin,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyCreateDraft);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<BranchDraft>(emptyDraft());
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<OrganizationBranch | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const branches = branchesQuery.data ?? [];

  const stats = useMemo(
    () => ({
      total: branches.length,
      active: branches.filter((b) => b.is_active).length,
      whatsapp: branches.filter((b) => b.whatsapp_instance_id?.trim()).length,
      pix: branches.filter((b) => b.pix_key?.trim()).length,
    }),
    [branches]
  );

  if (masterLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando...
      </div>
    );
  }

  if (!isClinicAccount || !isMaster) {
    return <Navigate to="/settings" replace />;
  }

  const editingBranch = editingId ? branches.find((b) => b.id === editingId) : null;

  const invalidateBranchQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['clinic-branches-admin'] });
    await queryClient.invalidateQueries({ queryKey: ['clinic-branches'] });
  };

  const resetCreateForm = () => {
    setCreateDraft(emptyCreateDraft());
    setShowLoginPassword(false);
  };

  const openCreate = () => {
    setEditingId(null);
    resetCreateForm();
    setCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createDraft.name.trim().length < 2) {
      toast.error('Informe o nome da filial.');
      return;
    }
    if (createDraft.loginFullName.trim().length < 2) {
      toast.error('Informe o nome do responsável pelo login da filial.');
      return;
    }
    if (!createDraft.loginEmail.trim()) {
      toast.error('Informe o e-mail do login da filial.');
      return;
    }
    if (createDraft.loginPassword.length < 8) {
      toast.error('Senha do login deve ter no mínimo 8 caracteres.');
      return;
    }
    setSavingCreate(true);
    try {
      const result = await createClinicBranch({
        name: createDraft.name.trim(),
        address: createDraft.address.trim() || null,
        phone: createDraft.phone.trim() || null,
        accent_color: createDraft.accentColor.trim() || null,
        login_full_name: createDraft.loginFullName.trim(),
        login_email: createDraft.loginEmail.trim(),
        login_password: createDraft.loginPassword,
      });
      toast.success(`Filial criada. Login: ${result.login.email}`);
      setCreateOpen(false);
      resetCreateForm();
      await invalidateBranchQueries();
      await queryClient.invalidateQueries({ queryKey: ['clinic-team'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar.');
    } finally {
      setSavingCreate(false);
    }
  };

  const startEdit = (branch: OrganizationBranch) => {
    setCreateOpen(false);
    setEditingId(branch.id);
    setEditDraft(branchToDraft(branch));
  };

  const handleSaveEdit = async () => {
    if (!editingId || editDraft.name.trim().length < 2) {
      toast.error('Informe o nome da filial.');
      return;
    }
    setSavingEdit(true);
    try {
      await updateClinicBranch({
        branch_id: editingId,
        name: editDraft.name.trim(),
        address: editDraft.address.trim() || null,
        phone: editDraft.phone.trim() || null,
        is_active: editDraft.is_active,
        accent_color: editDraft.accent_color.trim() || null,
        logo_url: editDraft.logo_url.trim() || null,
        whatsapp_instance_id: editDraft.whatsapp_instance_id.trim() || null,
        pix_key: editDraft.pix_key.trim() || null,
        pix_key_type: editDraft.pix_key.trim() ? editDraft.pix_key_type : null,
        pix_receiver_name: editDraft.pix_receiver_name.trim() || null,
      });
      toast.success('Filial atualizada.');
      setEditingId(null);
      await invalidateBranchQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      const result = await deleteClinicBranch(confirmDelete.id);
      toast.success(
        branches.length <= 1
          ? `Filial "${result.name}" excluída. Filial padrão (Matriz) recriada.`
          : `Filial "${result.name}" excluída.`
      );
      if (editingId === confirmDelete.id) {
        setEditingId(null);
      }
      setConfirmDelete(null);
      await invalidateBranchQueries();
      await queryClient.invalidateQueries({ queryKey: ['clinic-team'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary shrink-0" />
            Filiais da clínica
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Nome, cor, logo, PIX e WhatsApp por unidade. Vincule a{' '}
            <Link to="/settings/equipe" className="text-primary underline-offset-4 hover:underline">
              equipe
            </Link>{' '}
            a cada filial para filtrar agenda e relatórios.
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0 self-start" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova filial
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Unidades" value={stats.total} icon={Building2} />
        <StatCard label="Ativas" value={stats.active} icon={MapPin} />
        <StatCard label="Com WhatsApp" value={stats.whatsapp} icon={MessageCircle} />
        <StatCard label="Com PIX" value={stats.pix} icon={Wallet} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Unidades</CardTitle>
          <CardDescription>
            Cada filial pode ter identidade visual própria. Ao criar, um login de atendente é
            gerado automaticamente para a unidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {branchesQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando filiais...
            </div>
          ) : branches.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center space-y-3">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground px-4">
                Nenhuma filial cadastrada. Crie a primeira unidade da clínica.
              </p>
              <Button size="sm" className="gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Nova filial
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="space-y-3 md:hidden">
                {branches.map((b) => (
                  <div key={b.id} className="rounded-xl border p-4 space-y-3 bg-card">
                    <div className="flex items-start gap-3">
                      <BranchAvatar branch={b} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{b.name}</p>
                          <BranchColorDot color={b.accent_color} />
                        </div>
                        {b.address ? (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{b.address}</p>
                        ) : null}
                        {b.phone ? (
                          <p className="text-xs text-muted-foreground">{b.phone}</p>
                        ) : null}
                      </div>
                      <Badge variant={b.is_active ? 'default' : 'secondary'} className="shrink-0">
                        {b.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {b.whatsapp_instance_id ? (
                        <Badge variant="outline" className="font-normal truncate max-w-full">
                          WA: {b.whatsapp_instance_id}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                          Sem WhatsApp
                        </Badge>
                      )}
                      {b.pix_key ? (
                        <Badge variant="outline" className="font-normal">
                          PIX configurado
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => startEdit(b)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Gerenciar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={deletingId === b.id}
                        onClick={() => setConfirmDelete(b)}
                      >
                        {deletingId === b.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-[160px]">
                            <BranchAvatar branch={b} />
                            <div className="min-w-0">
                              <p className="font-medium flex items-center gap-1.5 truncate">
                                {b.name}
                                <BranchColorDot color={b.accent_color} />
                              </p>
                              {b.address ? (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {b.address}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {b.phone || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px]">
                          <span className="line-clamp-2">{b.whatsapp_instance_id || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={b.is_active ? 'default' : 'secondary'}>
                            {b.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => startEdit(b)}
                              title="Gerenciar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={deletingId === b.id}
                              onClick={() => setConfirmDelete(b)}
                              title="Excluir"
                            >
                              {deletingId === b.id ? (
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog: criar filial */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className={BRANCH_DIALOG_CLASS}>
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 pb-3 pt-4 pr-12 text-left sm:px-5 sm:pt-5">
            <DialogTitle className="text-base sm:text-lg">Nova filial</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Identidade da unidade e login de atendimento vinculado só a esta filial.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 space-y-5">
              <section className="space-y-3">
                <SectionTitle>Identidade da unidade</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="branch-name">Nome da unidade *</Label>
                    <Input
                      id="branch-name"
                      value={createDraft.name}
                      onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="Ex.: Unidade Centro"
                      required
                      minLength={2}
                    />
                    {branches.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Já cadastradas: {branches.map((b) => b.name).join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch-phone">Telefone</Label>
                    <Input
                      id="branch-phone"
                      value={createDraft.phone}
                      onChange={(e) => setCreateDraft((d) => ({ ...d, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch-address">Endereço</Label>
                    <Input
                      id="branch-address"
                      value={createDraft.address}
                      onChange={(e) => setCreateDraft((d) => ({ ...d, address: e.target.value }))}
                    />
                  </div>
                </div>
                <BranchAccentColorPicker
                  branchName={createDraft.name || 'Nova unidade'}
                  value={createDraft.accentColor}
                  onChange={(accentColor) => setCreateDraft((d) => ({ ...d, accentColor }))}
                />
              </section>

              <Separator />

              <section className="space-y-3">
                <SectionTitle>Login da filial</SectionTitle>
                <p className="text-xs text-muted-foreground">
                  Acesso restrito a esta unidade — WhatsApp, caixa e atendimento da filial.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="branch-login-name">Nome do responsável *</Label>
                    <Input
                      id="branch-login-name"
                      value={createDraft.loginFullName}
                      onChange={(e) =>
                        setCreateDraft((d) => ({ ...d, loginFullName: e.target.value }))
                      }
                      placeholder="Ex.: Maria — recepção Centro"
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch-login-email">E-mail *</Label>
                    <Input
                      id="branch-login-email"
                      type="email"
                      value={createDraft.loginEmail}
                      onChange={(e) =>
                        setCreateDraft((d) => ({ ...d, loginEmail: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch-login-password">Senha inicial *</Label>
                    <div className="relative">
                      <Input
                        id="branch-login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        value={createDraft.loginPassword}
                        onChange={(e) =>
                          setCreateDraft((d) => ({ ...d, loginPassword: e.target.value }))
                        }
                        minLength={8}
                        required
                        placeholder="Mínimo 8 caracteres"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowLoginPassword((v) => !v)}
                        aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showLoginPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="shrink-0 flex flex-wrap gap-2 border-t px-4 py-3 sm:px-5 bg-muted/20">
              <Button type="submit" disabled={savingCreate} className="gap-2">
                {savingCreate ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Criar filial e login
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar filial */}
      <Dialog
        open={Boolean(editingId && editingBranch)}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className={BRANCH_DIALOG_CLASS}>
          {editingId && editingBranch ? (
            <>
              <DialogHeader className="shrink-0 space-y-1 border-b px-4 pb-3 pt-4 pr-12 text-left sm:px-5 sm:pt-5">
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg min-w-0">
                  <BranchColorDot color={editDraft.accent_color} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Gerenciar — {editingBranch.name}</span>
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Identidade, contato, WhatsApp e cobrança desta unidade.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
                <div className="space-y-5">
                  <section className="space-y-3">
                    <SectionTitle>Identidade visual</SectionTitle>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-branch-name">Nome da unidade *</Label>
                        <Input
                          id="edit-branch-name"
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        />
                      </div>
                      <BranchAccentColorPicker
                        branchName={editDraft.name || editingBranch.name}
                        value={editDraft.accent_color}
                        onChange={(accent_color) => setEditDraft((d) => ({ ...d, accent_color }))}
                      />
                      <div className="space-y-1.5">
                        <Label>Logo da filial</Label>
                        <BranchLogoField
                          branchId={editingId}
                          value={editDraft.logo_url}
                          onChange={(logo_url) => setEditDraft((d) => ({ ...d, logo_url }))}
                        />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-3">
                    <SectionTitle>Contato</SectionTitle>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-branch-phone">Telefone</Label>
                        <Input
                          id="edit-branch-phone"
                          value={editDraft.phone}
                          onChange={(e) => setEditDraft((d) => ({ ...d, phone: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="edit-branch-address">Endereço</Label>
                        <Input
                          id="edit-branch-address"
                          value={editDraft.address}
                          onChange={(e) => setEditDraft((d) => ({ ...d, address: e.target.value }))}
                        />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-3">
                    <SectionTitle>WhatsApp e cobrança</SectionTitle>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-branch-wa">Instância WhatsApp (Evolution)</Label>
                        <Input
                          id="edit-branch-wa"
                          value={editDraft.whatsapp_instance_id}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, whatsapp_instance_id: e.target.value }))
                          }
                          placeholder="Ex.: pro-abc123..."
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Tipo da chave PIX</Label>
                          <Select
                            value={editDraft.pix_key_type}
                            onValueChange={(v) =>
                              setEditDraft((d) => ({ ...d, pix_key_type: v as PixKeyType }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PIX_KEY_TYPES.map(({ value, label }) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-branch-pix">Chave PIX</Label>
                          <Input
                            id="edit-branch-pix"
                            value={editDraft.pix_key}
                            onChange={(e) => setEditDraft((d) => ({ ...d, pix_key: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="edit-branch-pix-name">Nome do recebedor PIX</Label>
                          <Input
                            id="edit-branch-pix-name"
                            value={editDraft.pix_receiver_name}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, pix_receiver_name: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <Separator />

                  <section className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2.5">
                    <Switch
                      id="edit-branch-active"
                      checked={editDraft.is_active}
                      onCheckedChange={(v) => setEditDraft((d) => ({ ...d, is_active: v }))}
                    />
                    <Label htmlFor="edit-branch-active" className="cursor-pointer font-normal leading-snug">
                      Filial ativa
                      <span className="block text-xs text-muted-foreground">
                        Visível para a equipe e nos filtros
                      </span>
                    </Label>
                  </section>
                </div>
              </div>

              <div className="shrink-0 border-t bg-muted/20 px-4 py-3 sm:px-5">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="ghost"
                    className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive justify-center sm:justify-start"
                    disabled={deletingId === editingId}
                    onClick={() => {
                      const branch = branches.find((b) => b.id === editingId);
                      if (branch) setConfirmDelete(branch);
                    }}
                  >
                    {deletingId === editingId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Excluir
                  </Button>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button variant="outline" onClick={() => setEditingId(null)}>
                      Fechar
                    </Button>
                    <Button onClick={handleSaveEdit} disabled={savingEdit} className="gap-2">
                      {savingEdit ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir filial?</AlertDialogTitle>
            <AlertDialogDescription>
              A filial <strong>{confirmDelete?.name}</strong> será removida permanentemente.
              Os logins de atendentes desta unidade também serão excluídos.
              {branches.length <= 1 ? (
                <>
                  {' '}
                  Como é a única unidade, uma filial padrão (Matriz) será recriada automaticamente.
                </>
              ) : (
                <> Recebimentos e insumos vinculados permanecem no sistema, sem filial.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(deletingId)}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deletingId ? 'Excluindo...' : 'Excluir filial'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
