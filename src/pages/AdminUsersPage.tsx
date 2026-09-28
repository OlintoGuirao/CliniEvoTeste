import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminUsers, setUserBlocked, setUserAccountType, logAdminActivity, adminSetUserPassword, adminDeleteUser } from '@/services/api/adminApi';
import { fetchOrganizationMembersAdmin, type ClinicTeamMember } from '@/services/api/clinicTeamApi';
import { accountTypeLabel, isSharedOrgAccount, normalizeAccountType, type AccountType } from '@/lib/accountType';
import { getUiCopy } from '@/lib/uiCopy';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { KeyRound, Loader2, Search, Ban, CheckCircle, UserPlus, ChevronUp, ChevronDown, Copy, RefreshCw, Trash2 } from 'lucide-react';
import { AdminCreateUserDialog } from '@/components/admin/AdminCreateUserDialog';
import type { CreatedAdminUser } from '@/components/admin/AdminCreateUserForm';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ADMIN_EMAIL = 'admin@clinievo.com.br';

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_blocked?: boolean;
  blocked_at?: string | null;
  blocked_reason?: string | null;
  created_at?: string;
  disabled_modules?: string[] | null;
  account_type?: AccountType | null;
  organization_id?: string | null;
};

type SortKey = 'full_name' | 'email' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [list, setList] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('all');
  const [actionId, setActionId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailUser, setDetailUser] = useState<ProfileRow | null>(null);
  const [resetState, setResetState] = useState<{ open: boolean; userId: string; email: string; password: string; saving: boolean }>({
    open: false,
    userId: '',
    email: '',
    password: '',
    saving: false,
  });
  const [deleteState, setDeleteState] = useState<{ open: boolean; userId: string; email: string; name: string | null; deleting: boolean }>({
    open: false,
    userId: '',
    email: '',
    name: null,
    deleting: false,
  });
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [orgMembers, setOrgMembers] = useState<ClinicTeamMember[]>([]);
  const [loadingOrgMembers, setLoadingOrgMembers] = useState(false);

  const generateTempPassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let out = '';
    for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  };

  const openPasswordModal = (p: ProfileRow) => {
    setResetState({ open: true, userId: p.id, email: p.email, password: '', saving: false });
  };

  const openDeleteDialog = (p: ProfileRow) => {
    setDeleteState({
      open: true,
      userId: p.id,
      email: p.email,
      name: p.full_name,
      deleting: false,
    });
  };

  const submitDeleteUser = async () => {
    if (!deleteState.userId) return;
    if (deleteState.userId === user?.id) {
      toast.error('Você não pode excluir a si mesmo.');
      return;
    }
    setDeleteState((s) => ({ ...s, deleting: true }));
    const adminEmail = user?.email ?? '';
    try {
      await adminDeleteUser(deleteState.userId);
      setList((prev) => prev.filter((p) => p.id !== deleteState.userId));
      setSelectedIds((s) => {
        const next = new Set(s);
        next.delete(deleteState.userId);
        return next;
      });
      if (detailUser?.id === deleteState.userId) setDetailUser(null);
      await logAdminActivity({
        action: 'delete',
        entity_type: 'user',
        entity_id: deleteState.userId,
        admin_email: adminEmail,
        details: { email: deleteState.email },
      }).catch(() => {});
      toast.success('Usuário excluído permanentemente.');
      setDeleteState({ open: false, userId: '', email: '', name: null, deleting: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir usuário.');
      setDeleteState((s) => ({ ...s, deleting: false }));
    }
  };

  const submitPassword = async () => {
    const pw = resetState.password.trim();
    if (pw.length < 8) {
      toast.error('Senha deve ter no mínimo 8 caracteres.');
      return;
    }
    setResetState((s) => ({ ...s, saving: true }));
    try {
      await adminSetUserPassword({ userId: resetState.userId, password: pw });
      toast.success('Senha redefinida com sucesso.');
      setResetState((s) => ({ ...s, saving: false }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao redefinir senha.');
      setResetState((s) => ({ ...s, saving: false }));
    }
  };

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAdminUsers()
      .then((data) => {
        if (!cancelled) setList(data as ProfileRow[]);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!detailUser?.organization_id || !isSharedOrgAccount(detailUser.account_type)) {
      setOrgMembers([]);
      return;
    }
    let cancelled = false;
    setLoadingOrgMembers(true);
    fetchOrganizationMembersAdmin(detailUser.organization_id)
      .then((members) => {
        if (!cancelled) setOrgMembers(members);
      })
      .catch(() => {
        if (!cancelled) setOrgMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOrgMembers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailUser?.id, detailUser?.organization_id, detailUser?.account_type]);

  const filtered = useMemo(() => {
    let out = list;
    if (filter.trim()) {
      const q = filter.trim().toLowerCase();
      out = out.filter(
        (p) =>
          (p.full_name ?? '').toLowerCase().includes(q) ||
          (p.email ?? '').toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'active') out = out.filter((p) => !p.is_blocked);
    if (statusFilter === 'blocked') out = out.filter((p) => p.is_blocked);
    if (accountTypeFilter === 'solo' || accountTypeFilter === 'clinic' || accountTypeFilter === 'salon') {
      out = out.filter((p) => normalizeAccountType(p.account_type) === accountTypeFilter);
    }
    return out;
  }, [list, filter, statusFilter, accountTypeFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'full_name') cmp = (a.full_name || '').localeCompare(b.full_name || '');
      else if (sortKey === 'email') cmp = (a.email || '').localeCompare(b.email || '');
      else if (sortKey === 'status') cmp = (a.is_blocked ? 1 : 0) - (b.is_blocked ? 1 : 0);
      else if (sortKey === 'created_at') cmp = (a.created_at || '').localeCompare(b.created_at || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paginated = useMemo(
    () => sorted.slice((page - 1) * perPage, page * perPage),
    [sorted, page, perPage]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else setSortKey(key);
  };

  const toggleSelectAll = () => {
    const canSelect = paginated.filter((p) => p.email !== ADMIN_EMAIL);
    const allSelected = canSelect.every((p) => selectedIds.has(p.id));
    if (allSelected) setSelectedIds((s) => new Set([...s].filter((id) => !canSelect.find((p) => p.id === id))));
    else setSelectedIds((s) => new Set([...s, ...canSelect.map((p) => p.id)]));
  };

  const handleBlock = async (profileId: string, block: boolean) => {
    if (profileId === user?.id) {
      toast.error('Você não pode bloquear a si mesmo.');
      return;
    }
    setActionId(profileId);
    const adminEmail = user?.email ?? '';
    try {
      await setUserBlocked({ userId: profileId, blocked: block, reason: block ? 'Bloqueado pelo admin' : undefined });
      setList((prev) =>
        prev.map((p) =>
          p.id === profileId
            ? {
                ...p,
                is_blocked: block,
                blocked_at: block ? new Date().toISOString() : null,
                blocked_reason: block ? 'Bloqueado pelo admin' : null,
              }
            : p
        )
      );
      if (detailUser?.id === profileId) setDetailUser((u) => (u ? { ...u, is_blocked: block } : null));
      await logAdminActivity({
        action: block ? 'block' : 'unblock',
        entity_type: 'user',
        entity_id: profileId,
        admin_email: adminEmail,
      }).catch(() => {});
      toast.success(block ? 'Usuário bloqueado.' : 'Usuário desbloqueado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar');
    } finally {
      setActionId(null);
    }
  };

  const handleBulkBlock = async (block: boolean) => {
    const ids = [...selectedIds].filter((id) => list.find((p) => p.id === id && p.email !== ADMIN_EMAIL));
    if (ids.length === 0) return;
    setActionId('bulk');
    const adminEmail = user?.email ?? '';
    try {
      for (const id of ids) {
        await setUserBlocked({ userId: id, blocked: block, reason: block ? 'Bloqueado pelo admin' : undefined });
        await logAdminActivity({ action: block ? 'block' : 'unblock', entity_type: 'user', entity_id: id, admin_email: adminEmail }).catch(() => {});
      }
      setList((prev) =>
        prev.map((p) =>
          ids.includes(p.id) ? { ...p, is_blocked: block, blocked_at: block ? new Date().toISOString() : null, blocked_reason: block ? 'Bloqueado pelo admin' : null } : p
        )
      );
      setDetailUser((u) => (u && ids.includes(u.id) ? { ...u, is_blocked: block } : u));
      setSelectedIds(new Set());
      toast.success(block ? `${ids.length} usuário(s) bloqueado(s).` : `${ids.length} usuário(s) desbloqueado(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar');
    } finally {
      setActionId(null);
    }
  };

  const handleUserCreated = (created: CreatedAdminUser) => {
    if (!created.id) return;
    setList((prev) => [
      {
        id: created.id,
        email: created.email,
        full_name: created.full_name,
        is_blocked: false,
        account_type: created.account_type,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleAccountTypeChange = async (userId: string, nextType: AccountType) => {
    const current = list.find((p) => p.id === userId);
    if (!current || normalizeAccountType(current.account_type) === nextType) return;
    setActionId(userId);
    try {
      await setUserAccountType({
        userId,
        accountType: nextType,
        organizationName: current.full_name,
      });
      setList((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, account_type: nextType } : p))
      );
      setDetailUser((prev) => (prev?.id === userId ? { ...prev, account_type: nextType } : prev));
      await logAdminActivity({
        action: 'update',
        entity_type: 'user',
        entity_id: userId,
        details: { account_type: nextType },
        admin_email: user?.email ?? '',
      }).catch(() => {});
      toast.success(
        nextType === 'salon'
          ? 'Conta marcada como Cabeleireiro (Salão).'
          : nextType === 'clinic'
            ? 'Conta marcada como Clínica.'
            : 'Conta marcada como Profissional único.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível alterar o tipo de conta.');
    } finally {
      setActionId(null);
    }
  };

  if (!user || user.email !== ADMIN_EMAIL) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie usuários e bloqueios</p>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={() => setCreateUserOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Adicionar Novo Usuário
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-4">
            <CardTitle className="text-lg">Lista de usuários</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  placeholder="Filtrar por nome ou e-mail..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9"
                  aria-label="Buscar usuários"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" aria-label="Filtrar por status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="blocked">Bloqueados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
                <SelectTrigger className="w-[180px]" aria-label="Filtrar por tipo de conta">
                  <SelectValue placeholder="Tipo de conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="solo">Profissional único</SelectItem>
                  <SelectItem value="clinic">Clínica</SelectItem>
                  <SelectItem value="salon">Cabeleireiro (Salão)</SelectItem>
                </SelectContent>
              </Select>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm text-muted-foreground">{selectedIds.size} selecionado(s)</span>
                  <Button variant="outline" size="sm" onClick={() => handleBulkBlock(true)} disabled={!!actionId}>
                    Bloquear
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkBlock(false)} disabled={!!actionId}>
                    Desbloquear
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              <span>Carregando...</span>
            </div>
          )}

          {error && (
            <div className="py-4 text-center text-destructive text-sm" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="rounded-md border overflow-auto max-h-[55vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={paginated.filter((p) => p.email !== ADMIN_EMAIL).length > 0 && paginated.filter((p) => p.email !== ADMIN_EMAIL).every((p) => selectedIds.has(p.id))}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" className="-ml-2 gap-1" onClick={() => toggleSort('full_name')}>
                          Nome
                          {sortKey === 'full_name' ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" className="-ml-2 gap-1" onClick={() => toggleSort('email')}>
                          E-mail
                          {sortKey === 'email' ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
                        </Button>
                      </TableHead>
                      <TableHead>Tipo de conta</TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" className="-ml-2 gap-1" onClick={() => toggleSort('status')}>
                          Status
                          {sortKey === 'status' ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
                        </Button>
                      </TableHead>
                      <TableHead>Data cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((p) => (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setDetailUser(p)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {p.email !== ADMIN_EMAIL && (
                            <Checkbox
                              checked={selectedIds.has(p.id)}
                              onCheckedChange={(checked) =>
                                setSelectedIds((s) => {
                                  const next = new Set(s);
                                  if (checked) next.add(p.id);
                                  else next.delete(p.id);
                                  return next;
                                })
                              }
                              aria-label={`Selecionar ${p.full_name || p.email}`}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block max-w-[160px] truncate" title={p.full_name ?? p.email}>
                                  {p.full_name || '—'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{p.full_name ?? p.email}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block max-w-[180px] truncate" title={p.email}>
                                  {p.email}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{p.email}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {p.email === ADMIN_EMAIL
                            ? 'Admin'
                            : accountTypeLabel(p.account_type)}
                        </TableCell>
                        <TableCell>
                          {p.is_blocked ? (
                            <Badge variant="destructive">Bloqueado</Badge>
                          ) : (
                            <Badge variant="secondary">Ativo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm tabular-nums">
                          {p.created_at ? format(parseISO(p.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {p.email === ADMIN_EMAIL ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : actionId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin inline-block ml-auto" aria-hidden />
                          ) : p.is_blocked ? (
                            <div className="inline-flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPasswordModal(p)}
                                title="Redefinir senha manualmente"
                              >
                                <KeyRound className="h-4 w-4 mr-1" aria-hidden />
                                Senha
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => openDeleteDialog(p)}
                                title="Excluir usuário permanentemente"
                              >
                                <Trash2 className="h-4 w-4 mr-1" aria-hidden />
                                Excluir
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleBlock(p.id, false)}>
                                <CheckCircle className="h-4 w-4 mr-1" aria-hidden />
                                Desbloquear
                              </Button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPasswordModal(p)}
                                title="Redefinir senha manualmente"
                              >
                                <KeyRound className="h-4 w-4 mr-1" aria-hidden />
                                Senha
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => openDeleteDialog(p)}
                                title="Excluir usuário permanentemente"
                              >
                                <Trash2 className="h-4 w-4 mr-1" aria-hidden />
                                Excluir
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleBlock(p.id, true)}>
                                <Ban className="h-4 w-4 mr-1" aria-hidden />
                                Bloquear
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Itens por página:</span>
                  <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                    <SelectTrigger className="w-[70px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>
                    {(page - 1) * perPage + 1}-{Math.min(page * perPage, sorted.length)} de {sorted.length}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}

          {!loading && !error && filtered.length === 0 && (
            <p className="py-6 text-center text-muted-foreground text-sm">
              Nenhum usuário encontrado.
            </p>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!detailUser} onOpenChange={(open) => !open && setDetailUser(null)}>
        <SheetContent className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Detalhes do usuário</SheetTitle>
          </SheetHeader>
          {detailUser && (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Nome</p>
                <p className="font-medium">{detailUser.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">E-mail</p>
                <p className="font-medium break-all">{detailUser.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Perfil</p>
                <p className="font-medium">{detailUser.email === ADMIN_EMAIL ? 'Admin' : 'Profissional'}</p>
              </div>
              {detailUser.email !== ADMIN_EMAIL && (
                <div className="space-y-2">
                  <p className="text-muted-foreground">Tipo de conta</p>
                  <Select
                    value={normalizeAccountType(detailUser.account_type)}
                    onValueChange={(value) =>
                      void handleAccountTypeChange(detailUser.id, normalizeAccountType(value))
                    }
                    disabled={actionId === detailUser.id}
                  >
                    <SelectTrigger aria-label="Alterar tipo de conta">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solo">Profissional único</SelectItem>
                      <SelectItem value="clinic">Clínica</SelectItem>
                      <SelectItem value="salon">Cabeleireiro (Salão)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {normalizeAccountType(detailUser.account_type) === 'salon'
                      ? 'Salão = Admin pode atender e adicionar profissionais.'
                      : 'Clínica = Master da conta. Filiais e equipe nas configurações.'}
                  </p>
                </div>
              )}
              {detailUser.email !== ADMIN_EMAIL &&
                isSharedOrgAccount(detailUser.account_type) && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-muted-foreground">
                    {getUiCopy(detailUser.account_type).team}
                  </p>
                  {loadingOrgMembers ? (
                    <p className="text-xs text-muted-foreground">Carregando membros...</p>
                  ) : orgMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum membro listado.</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {orgMembers.map((m) => (
                        <li key={m.membership_id} className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {m.full_name || m.email}
                            <span className="text-muted-foreground">
                              {' '}
                              · {m.role === 'owner' ? 'Master' : 'Profissional'}
                            </span>
                          </span>
                          {m.is_blocked ? (
                            <Badge variant="destructive" className="shrink-0">
                              Bloqueado
                            </Badge>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium">{detailUser.is_blocked ? 'Bloqueado' : 'Ativo'}</p>
              </div>
              {detailUser.created_at && (
                <div>
                  <p className="text-muted-foreground">Data de cadastro</p>
                  <p className="font-medium">{format(parseISO(detailUser.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              )}
              {detailUser.email !== ADMIN_EMAIL && (
                <div className="pt-4 flex gap-2">
                  {actionId === detailUser.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : detailUser.is_blocked ? (
                    <Button variant="outline" size="sm" onClick={() => handleBlock(detailUser.id, false)}>
                      Desbloquear
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleBlock(detailUser.id, true)}>
                      Bloquear
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={resetState.open} onOpenChange={(open) => setResetState((s) => ({ ...s, open }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              Por segurança, não é possível “visualizar” a senha. Aqui você define uma nova senha manualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>E-mail</Label>
            <div className="text-sm font-medium break-all">{resetState.email}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Nova senha</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setResetState((s) => ({ ...s, password: generateTempPassword() }))}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Gerar
              </Button>
            </div>
            <div className="flex items-start gap-2">
              <Input
                value={resetState.password}
                onChange={(e) => setResetState((s) => ({ ...s, password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(resetState.password || '');
                    toast.success('Senha copiada.');
                  } catch {
                    toast.error('Não foi possível copiar.');
                  }
                }}
                aria-label="Copiar senha"
                title="Copiar senha"
                disabled={!resetState.password}
              >
                <Copy className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetState((s) => ({ ...s, open: false }))}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitPassword} disabled={resetState.saving || !resetState.password.trim()}>
              {resetState.saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteState.open}
        onOpenChange={(open) => !deleteState.deleting && setDeleteState((s) => ({ ...s, open }))}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e não pode ser desfeita. O perfil, pacientes e dados vinculados a{' '}
              <span className="font-medium text-foreground">
                {deleteState.name || deleteState.email}
              </span>{' '}
              serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteState.deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteState.deleting}
              onClick={(e) => {
                e.preventDefault();
                void submitDeleteUser();
              }}
            >
              {deleteState.deleting ? 'Excluindo…' : 'Excluir usuário'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminCreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onCreated={handleUserCreated}
      />
    </div>
  );
}
