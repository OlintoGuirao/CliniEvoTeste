import { useMemo, useState, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { useSalonAccount } from '@/hooks/use-salon-account';
import { useUiCopy } from '@/hooks/use-ui-copy';
import {
  createClinicProfessional,
  fetchClinicTeam,
  removeClinicProfessional,
  updateClinicMember,
  type ClinicTeamMember,
} from '@/services/api/clinicTeamApi';
import { fetchClinicBranchesAdmin } from '@/services/api/clinicBranchesApi';
import {
  ClinicMemberRoleFields,
  emptyMemberRoleDraft,
  memberRoleDraftFromProfile,
  resolveCouncilBody,
  resolveRegistryNumber,
  resolveStaffTitle,
  type ClinicMemberRoleDraft,
} from '@/components/clinic/ClinicMemberRoleFields';
import { SalonMemberLabelColorPicker } from '@/components/salon/SalonMemberLabelColorPicker';
import { memberDisplayRole } from '@/lib/clinicTeamRoles';
import {
  DEFAULT_SALON_LABEL_COLOR,
  SALON_STAFF_ROLES,
  normalizeAgendaLabelColor,
  salonStaffRoleLabel,
} from '@/lib/salonTeamRoles';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import {
  Building2,
  Crown,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Scissors,
  Stethoscope,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const TEAM_DIALOG_CLASS =
  '!flex !max-h-[min(92dvh,780px)] w-[calc(100vw-1.25rem)] !max-w-2xl !flex-col !gap-0 !overflow-hidden !p-0 sm:!rounded-xl';

function roleLabel(role: ClinicTeamMember['role'], isSalon: boolean) {
  if (role === 'owner') return isSalon ? 'Admin' : 'Master';
  if (role === 'attendant') return 'Atendente';
  return isSalon ? 'Profissional' : 'Profissional';
}

function memberInitials(name: string | null, email: string) {
  const base = name?.trim() || email;
  if (!base) return 'U';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

type EditDraft = {
  fullName: string;
  branchId: string;
  roleDraft: ClinicMemberRoleDraft;
  salonStaffRole: string;
  salonStaffOther: string;
  agendaLabelColor: string;
};

function memberToEditDraft(member: ClinicTeamMember, isSalon: boolean): EditDraft {
  const knownSalon = SALON_STAFF_ROLES.some((r) => r.id === member.staff_title);
  return {
    fullName: member.full_name ?? '',
    branchId: member.branch_id ?? '',
    roleDraft: memberRoleDraftFromProfile({
      councilBody: member.professional_registry_body,
      registryNumber: member.professional_registry_number,
      specialty: member.professional_specialty,
      staffTitle: member.staff_title,
      systemRole: member.role === 'attendant' ? 'attendant' : 'professional',
    }),
    salonStaffRole: isSalon
      ? knownSalon
        ? (member.staff_title as string)
        : member.staff_title
          ? 'outro'
          : 'cabeleireiro'
      : '',
    salonStaffOther:
      isSalon && member.staff_title && !knownSalon ? member.staff_title : '',
    agendaLabelColor:
      normalizeAgendaLabelColor(member.agenda_label_color) ?? DEFAULT_SALON_LABEL_COLOR,
  };
}

function MemberAvatar({
  name,
  email,
  isOwner,
  labelColor,
}: {
  name: string | null;
  email: string;
  isOwner?: boolean;
  labelColor?: string | null;
}) {
  const color = normalizeAgendaLabelColor(labelColor ?? undefined);
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        isOwner && !color ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      )}
      style={
        color
          ? { backgroundColor: `${color}33`, color, boxShadow: `inset 0 0 0 2px ${color}` }
          : undefined
      }
    >
      {isOwner ? <Crown className="h-4 w-4" /> : memberInitials(name, email)}
    </div>
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

function resolveSalonStaffTitle(roleId: string, other: string): string | null {
  if (!roleId) return null;
  if (roleId === 'outro') return other.trim() || null;
  return roleId;
}

export default function SettingsClinicTeam() {
  const { profile } = useAuth();
  const { isMaster: isClinicMaster, isLoading: clinicLoading } = useClinicMaster();
  const { isSalonAccount: isSalon, isSalonAdmin, isLoading: salonLoading } = useSalonAccount();
  const copy = useUiCopy();
  const queryClient = useQueryClient();
  const canManageTeam = isClinicMaster || isSalonAdmin;
  const masterLoading = clinicLoading || salonLoading;

  const teamQuery = useQuery({
    queryKey: ['clinic-team', profile?.id],
    enabled: Boolean(canManageTeam),
    queryFn: fetchClinicTeam,
  });

  const branchesQuery = useQuery({
    queryKey: ['clinic-branches-admin'],
    enabled: Boolean(isClinicMaster),
    queryFn: fetchClinicBranchesAdmin,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [branchId, setBranchId] = useState<string>('');
  const [createRoleDraft, setCreateRoleDraft] = useState<ClinicMemberRoleDraft>(emptyMemberRoleDraft());
  const [salonStaffRole, setSalonStaffRole] = useState('cabeleireiro');
  const [salonStaffOther, setSalonStaffOther] = useState('');
  const [agendaLabelColor, setAgendaLabelColor] = useState(DEFAULT_SALON_LABEL_COLOR);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ClinicTeamMember | null>(null);
  const [editingMember, setEditingMember] = useState<ClinicTeamMember | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    fullName: '',
    branchId: '',
    roleDraft: emptyMemberRoleDraft(),
    salonStaffRole: 'cabeleireiro',
    salonStaffOther: '',
    agendaLabelColor: DEFAULT_SALON_LABEL_COLOR,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const members = teamQuery.data?.members ?? [];
  const professionals = useMemo(
    () => members.filter((m) => m.role !== 'owner'),
    [members]
  );

  const stats = useMemo(() => {
    const team = professionals;
    if (isSalon) {
      return {
        total: team.length,
        withColor: members.filter((m) => Boolean(m.agenda_label_color)).length,
        hair: team.filter((m) =>
          ['cabeleireiro', 'barbeiro'].includes(String(m.staff_title || ''))
        ).length,
        beauty: team.filter((m) =>
          ['manicure', 'pedicure', 'maquiagem', 'esteticista'].includes(String(m.staff_title || ''))
        ).length,
      };
    }
    return {
      total: team.length,
      clinical: team.filter((m) => Boolean(m.professional_registry_body)).length,
      attendants: team.filter((m) => m.role === 'attendant').length,
      admin: team.filter((m) => !m.professional_registry_body && m.staff_title).length,
    };
  }, [professionals, members, isSalon]);

  const buildEditDraft = useCallback(
    (member: ClinicTeamMember) => {
      const fresh = members.find((m) => m.user_id === member.user_id) ?? member;
      return memberToEditDraft(fresh, isSalon);
    },
    [members, isSalon]
  );

  if (masterLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando...
      </div>
    );
  }

  if (!canManageTeam) {
    return <Navigate to="/settings" replace />;
  }

  const resetCreateForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setBranchId('');
    setCreateRoleDraft(emptyMemberRoleDraft());
    setSalonStaffRole('cabeleireiro');
    setSalonStaffOther('');
    setAgendaLabelColor(DEFAULT_SALON_LABEL_COLOR);
    setShowPassword(false);
  };

  const openCreate = () => {
    setEditingMember(null);
    resetCreateForm();
    setCreateOpen(true);
  };

  const startEdit = (member: ClinicTeamMember) => {
    setCreateOpen(false);
    setEditingMember(member);
    setEditDraft(buildEditDraft(member));
  };

  const buildRolePayload = (draft: ClinicMemberRoleDraft) => ({
    role: draft.systemRole,
    professional_registry_body: resolveCouncilBody(draft),
    professional_registry_number: resolveCouncilBody(draft)
      ? resolveRegistryNumber(draft)
      : null,
    professional_specialty: resolveCouncilBody(draft) ? draft.specialty.trim() || null : null,
    staff_title: resolveStaffTitle(draft),
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      toast.error('Informe o nome completo.');
      return;
    }
    if (password.length < 8) {
      toast.error('Senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (isSalon) {
      const title = resolveSalonStaffTitle(salonStaffRole, salonStaffOther);
      if (!title) {
        toast.error('Selecione o perfil no salão.');
        return;
      }
    }
    setSaving(true);
    try {
      if (isSalon) {
        await createClinicProfessional({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          branch_id: null,
          role: 'professional',
          professional_registry_body: null,
          professional_registry_number: null,
          professional_specialty: null,
          staff_title: resolveSalonStaffTitle(salonStaffRole, salonStaffOther),
          agenda_label_color: normalizeAgendaLabelColor(agendaLabelColor) ?? DEFAULT_SALON_LABEL_COLOR,
        });
      } else {
        await createClinicProfessional({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          branch_id: branchId || null,
          ...buildRolePayload(createRoleDraft),
        });
      }
      toast.success('Membro adicionado à equipe.');
      setCreateOpen(false);
      resetCreateForm();
      await queryClient.refetchQueries({ queryKey: ['clinic-team', profile?.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    if (editDraft.fullName.trim().length < 2) {
      toast.error('Informe o nome completo.');
      return;
    }
    if (isSalon) {
      const title = resolveSalonStaffTitle(editDraft.salonStaffRole, editDraft.salonStaffOther);
      if (!title) {
        toast.error('Selecione o perfil no salão.');
        return;
      }
    }
    setSavingEdit(true);
    try {
      if (isSalon && editingMember.role === 'owner') {
        await updateClinicMember({
          user_id: editingMember.user_id,
          full_name: editDraft.fullName.trim(),
          staff_title: resolveSalonStaffTitle(
            editDraft.salonStaffRole,
            editDraft.salonStaffOther
          ),
          agenda_label_color:
            normalizeAgendaLabelColor(editDraft.agendaLabelColor) ?? DEFAULT_SALON_LABEL_COLOR,
        });
      } else if (isSalon) {
        await updateClinicMember({
          user_id: editingMember.user_id,
          full_name: editDraft.fullName.trim(),
          branch_id: null,
          role: 'professional',
          professional_registry_body: null,
          professional_registry_number: null,
          professional_specialty: null,
          staff_title: resolveSalonStaffTitle(
            editDraft.salonStaffRole,
            editDraft.salonStaffOther
          ),
          agenda_label_color:
            normalizeAgendaLabelColor(editDraft.agendaLabelColor) ?? DEFAULT_SALON_LABEL_COLOR,
        });
      } else {
        await updateClinicMember({
          user_id: editingMember.user_id,
          full_name: editDraft.fullName.trim(),
          branch_id: editDraft.branchId || null,
          ...buildRolePayload(editDraft.roleDraft),
        });
      }
      toast.success('Membro atualizado.');
      setEditingMember(null);
      await queryClient.refetchQueries({ queryKey: ['clinic-team', profile?.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    setRemovingId(confirmRemove.user_id);
    try {
      await removeClinicProfessional(confirmRemove.user_id);
      toast.success('Membro removido. O login foi excluído e não tem mais acesso.');
      if (editingMember?.user_id === confirmRemove.user_id) {
        setEditingMember(null);
      }
      setConfirmRemove(null);
      await queryClient.invalidateQueries({ queryKey: ['clinic-team', profile?.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover.');
    } finally {
      setRemovingId(null);
    }
  };

  const renderMemberRole = (m: ClinicTeamMember) =>
    isSalon
      ? salonStaffRoleLabel(m.staff_title)
      : memberDisplayRole({
          role: m.role,
          councilBody: m.professional_registry_body,
          specialty: m.professional_specialty,
          staffTitle: m.staff_title,
        });

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <UsersRound className="h-6 w-6 text-primary shrink-0" />
            {copy.team}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            {isSalon
              ? 'Cadastre a equipe do salão com login próprio, perfil (cabeleireiro, manicure…) e cor de etiqueta na agenda.'
              : 'Cadastre profissionais de saúde e funções administrativas. Cada membro tem login próprio com acesso conforme conselho ou função.'}
          </p>
          {teamQuery.data?.organization?.name ? (
            <Badge variant="outline" className="mt-2 font-normal">
              {teamQuery.data.organization.name}
            </Badge>
          ) : null}
        </div>
        <Button size="sm" className="gap-2 shrink-0 self-start" onClick={openCreate}>
          <UserPlus className="h-4 w-4" />
          Adicionar membro
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isSalon ? (
          <>
            <StatCard label="Membros" value={stats.total} icon={UsersRound} />
            <StatCard label="Cabelo" value={'hair' in stats ? stats.hair : 0} icon={Scissors} />
            <StatCard label="Beleza" value={'beauty' in stats ? stats.beauty : 0} icon={UserCheck} />
            <StatCard
              label="Com etiqueta"
              value={'withColor' in stats ? stats.withColor : 0}
              icon={Building2}
            />
          </>
        ) : (
          <>
            <StatCard label="Membros" value={stats.total} icon={UsersRound} />
            <StatCard
              label="Com conselho"
              value={'clinical' in stats ? stats.clinical : 0}
              icon={Stethoscope}
            />
            <StatCard
              label="Atendentes"
              value={'attendants' in stats ? stats.attendants : 0}
              icon={UserCheck}
            />
            <StatCard
              label="Administrativos"
              value={'admin' in stats ? stats.admin : 0}
              icon={Building2}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Equipe</CardTitle>
          <CardDescription>
            {isSalon ? (
              'Cada profissional pertence a este salão. A cor da etiqueta aparece nos horários da agenda.'
            ) : (
              <>
                Vincule membros a uma{' '}
                <Link
                  to="/settings/filiais"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  filial
                </Link>{' '}
                para filtrar agenda, caixa e relatórios por unidade.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {teamQuery.isLoading ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando equipe...
            </div>
          ) : teamQuery.isError ? (
            <p className="text-sm text-destructive py-4">
              {teamQuery.error instanceof Error
                ? teamQuery.error.message
                : 'Erro ao carregar equipe.'}
            </p>
          ) : members.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center space-y-3">
              <UsersRound className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="space-y-3 md:hidden">
                {members.map((m) => (
                  <div
                    key={m.membership_id}
                    className="rounded-xl border p-4 space-y-3 bg-card"
                  >
                    <div className="flex items-start gap-3">
                      <MemberAvatar
                        name={m.full_name}
                        email={m.email}
                        isOwner={m.role === 'owner'}
                        labelColor={isSalon ? m.agenda_label_color : null}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{m.full_name || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        {!isSalon ? (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {m.branch_name || 'Sem filial'}
                          </p>
                        ) : null}
                      </div>
                      {m.is_blocked ? (
                        <Badge variant="destructive" className="shrink-0">
                          Bloqueado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">
                          Ativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {isSalon && m.agenda_label_color ? (
                        <span
                          className="h-3.5 w-3.5 rounded-full border shrink-0"
                          style={{ backgroundColor: m.agenda_label_color }}
                          title="Etiqueta na agenda"
                        />
                      ) : null}
                      <Badge variant="secondary" className="font-normal max-w-full truncate">
                        {renderMemberRole(m)}
                      </Badge>
                      <Badge variant={m.role === 'owner' ? 'default' : 'outline'}>
                        {roleLabel(m.role, isSalon)}
                      </Badge>
                    </div>
                    {m.role !== 'owner' ? (
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => startEdit(m)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={removingId === m.user_id}
                          onClick={() => setConfirmRemove(m)}
                        >
                          {removingId === m.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ) : isSalon ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1"
                        onClick={() => startEdit(m)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar perfil e etiqueta
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Membro</TableHead>
                      {!isSalon ? <TableHead>Filial</TableHead> : <TableHead>Etiqueta</TableHead>}
                      <TableHead>Função</TableHead>
                      <TableHead>Acesso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Desde</TableHead>
                      <TableHead className="text-right w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.membership_id}>
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-[180px]">
                            <MemberAvatar
                              name={m.full_name}
                              email={m.email}
                              isOwner={m.role === 'owner'}
                              labelColor={isSalon ? m.agenda_label_color : null}
                            />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{m.full_name || '—'}</p>
                              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {isSalon ? (
                            m.agenda_label_color ? (
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className="h-4 w-4 rounded-full border"
                                  style={{ backgroundColor: m.agenda_label_color }}
                                />
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {m.agenda_label_color}
                                </span>
                              </span>
                            ) : m.role === 'owner' ? (
                              <button
                                type="button"
                                className="text-xs text-primary underline-offset-4 hover:underline"
                                onClick={() => startEdit(m)}
                              >
                                Escolher cor
                              </button>
                            ) : (
                              '—'
                            )
                          ) : (
                            m.branch_name || '—'
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-[220px]">
                          <span className="line-clamp-2">{renderMemberRole(m)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>
                            {roleLabel(m.role, isSalon)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {m.is_blocked ? (
                            <Badge variant="destructive">Bloqueado</Badge>
                          ) : (
                            <Badge variant="outline">Ativo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-sm tabular-nums">
                          {m.created_at
                            ? format(parseISO(m.created_at), 'dd/MM/yyyy', { locale: ptBR })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.role === 'owner' ? (
                            isSalon ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => startEdit(m)}
                                title="Editar perfil e etiqueta"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => startEdit(m)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={removingId === m.user_id}
                                onClick={() => setConfirmRemove(m)}
                                title="Remover"
                              >
                                {removingId === m.user_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {professionals.length === 0 && members.length <= 1 && (
                <div className="rounded-xl border border-dashed py-8 text-center space-y-3 mt-2">
                  <UserPlus className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground px-4">
                    {isSalon
                      ? 'Ainda só você (Admin) na equipe. Adicione o primeiro profissional do salão.'
                      : 'Ainda só você (Master) na equipe. Adicione o primeiro profissional ou funcionário administrativo.'}
                  </p>
                  <Button size="sm" className="gap-2" onClick={openCreate}>
                    <UserPlus className="h-4 w-4" />
                    Adicionar membro
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog: criar membro */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className={TEAM_DIALOG_CLASS}>
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 pb-3 pt-4 pr-12 text-left sm:px-5 sm:pt-5">
            <DialogTitle className="text-base sm:text-lg">Adicionar membro</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {isSalon
                ? 'Nome, acesso, perfil no salão e cor da etiqueta na agenda.'
                : 'Dados de acesso, filial e perfil profissional ou administrativo.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 space-y-5">
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dados pessoais
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="clinic-pro-name">Nome completo *</Label>
                    <Input
                      id="clinic-pro-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      minLength={2}
                      placeholder={isSalon ? 'Ex.: Zezinho' : 'Ex.: Dra. Ana Silva'}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="clinic-pro-email">E-mail *</Label>
                    <Input
                      id="clinic-pro-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder={isSalon ? 'login@salao.com' : 'login@clinica.com'}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="clinic-pro-password">Senha inicial *</Label>
                    <div className="relative">
                      <Input
                        id="clinic-pro-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="Mínimo 8 caracteres"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {isSalon ? (
                <>
                  <Separator />
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Perfil no salão
                    </h3>
                    <div className="space-y-1.5 max-w-sm">
                      <Label>Função *</Label>
                      <Select value={salonStaffRole} onValueChange={setSalonStaffRole}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o perfil" />
                        </SelectTrigger>
                        <SelectContent>
                          {SALON_STAFF_ROLES.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {salonStaffRole === 'outro' ? (
                      <div className="space-y-1.5 max-w-sm">
                        <Label htmlFor="salon-pro-other">Descreva a função *</Label>
                        <Input
                          id="salon-pro-other"
                          value={salonStaffOther}
                          onChange={(e) => setSalonStaffOther(e.target.value)}
                          required
                          placeholder="Ex.: Depiladora"
                        />
                      </div>
                    ) : null}
                  </section>
                  <Separator />
                  <SalonMemberLabelColorPicker
                    id="salon-create-label"
                    value={agendaLabelColor}
                    onChange={setAgendaLabelColor}
                  />
                </>
              ) : (
                <>
                  <Separator />
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Unidade
                    </h3>
                    <div className="space-y-1.5 max-w-sm">
                      <Label>Filial</Label>
                      <Select
                        value={branchId || 'none'}
                        onValueChange={(v) => setBranchId(v === 'none' ? '' : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a filial" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem filial (visível ao Master)</SelectItem>
                          {(branchesQuery.data ?? []).map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </section>
                  <Separator />
                  <ClinicMemberRoleFields
                    idPrefix="clinic-create"
                    draft={createRoleDraft}
                    onChange={(patch) => setCreateRoleDraft((d) => ({ ...d, ...patch }))}
                  />
                </>
              )}
            </div>

            <div className="shrink-0 flex flex-wrap gap-2 border-t px-4 py-3 sm:px-5 bg-muted/20">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Criar membro
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

      {/* Dialog: editar membro */}
      <Dialog
        open={Boolean(editingMember)}
        onOpenChange={(open) => {
          if (!open) setEditingMember(null);
        }}
      >
        <DialogContent className={TEAM_DIALOG_CLASS}>
          {editingMember ? (
            <>
              <DialogHeader className="shrink-0 space-y-1 border-b px-4 pb-3 pt-4 pr-12 text-left sm:px-5 sm:pt-5">
                <DialogTitle className="text-base sm:text-lg truncate">
                  {editingMember.role === 'owner' && isSalon
                    ? 'Seu perfil no salão'
                    : `Editar — ${editingMember.full_name || editingMember.email}`}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm truncate">
                  {editingMember.role === 'owner' && isSalon
                    ? 'Nome, função e cor da etiqueta na agenda.'
                    : editingMember.email}
                </DialogDescription>
              </DialogHeader>

              <form
                key={editingMember.user_id}
                onSubmit={handleSaveEdit}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 space-y-5">
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Dados pessoais
                    </h3>
                    <div className="space-y-1.5">
                      <Label htmlFor="clinic-edit-name">Nome completo *</Label>
                      <Input
                        id="clinic-edit-name"
                        value={editDraft.fullName}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, fullName: e.target.value }))
                        }
                        required
                        minLength={2}
                      />
                    </div>
                  </section>

                  {isSalon ? (
                    <>
                      <Separator />
                      <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Perfil no salão
                        </h3>
                        <div className="space-y-1.5 max-w-sm">
                          <Label>Função *</Label>
                          <Select
                            value={editDraft.salonStaffRole}
                            onValueChange={(v) =>
                              setEditDraft((d) => ({ ...d, salonStaffRole: v }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o perfil" />
                            </SelectTrigger>
                            <SelectContent>
                              {SALON_STAFF_ROLES.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {editDraft.salonStaffRole === 'outro' ? (
                          <div className="space-y-1.5 max-w-sm">
                            <Label htmlFor="salon-edit-other">Descreva a função *</Label>
                            <Input
                              id="salon-edit-other"
                              value={editDraft.salonStaffOther}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  salonStaffOther: e.target.value,
                                }))
                              }
                              required
                            />
                          </div>
                        ) : null}
                      </section>
                      <Separator />
                      <SalonMemberLabelColorPicker
                        id="salon-edit-label"
                        value={editDraft.agendaLabelColor}
                        onChange={(hex) =>
                          setEditDraft((d) => ({ ...d, agendaLabelColor: hex }))
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Separator />
                      <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Unidade
                        </h3>
                        <div className="space-y-1.5 max-w-sm">
                          <Label>Filial</Label>
                          <Select
                            value={editDraft.branchId || 'none'}
                            onValueChange={(v) =>
                              setEditDraft((d) => ({ ...d, branchId: v === 'none' ? '' : v }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a filial" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem filial</SelectItem>
                              {(branchesQuery.data ?? []).map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </section>
                      <Separator />
                      <ClinicMemberRoleFields
                        idPrefix="clinic-edit"
                        draft={editDraft.roleDraft}
                        onChange={(patch) =>
                          setEditDraft((d) => ({
                            ...d,
                            roleDraft: { ...d.roleDraft, ...patch },
                          }))
                        }
                      />
                    </>
                  )}
                </div>

                <div className="shrink-0 flex flex-wrap gap-2 border-t px-4 py-3 sm:px-5 bg-muted/20">
                  <Button type="submit" disabled={savingEdit} className="gap-2">
                    {savingEdit ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar alterações'
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingMember(null)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da equipe?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove?.full_name || confirmRemove?.email} será removido {copy.orgOf} e o{' '}
              <strong>login será excluído</strong>. Essa pessoa não terá mais nenhum acesso ao
              sistema. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRemove()}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
