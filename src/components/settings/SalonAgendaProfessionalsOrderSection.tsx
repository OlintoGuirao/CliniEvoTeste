import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSalonAccount } from '@/hooks/use-salon-account';
import {
  fetchSalonAgendaTeamMembers,
  isSalonAgendaBookableMember,
  mapSalonAgendaProfessional,
  saveAndReloadSalonAgendaProfessionalsOrder,
  salonAgendaTeamQueryKey,
  sortSalonAgendaMembers,
  type SalonAgendaMemberSortable,
} from '@/lib/salonAgendaProfessionals';
import { salonStaffRoleLabel } from '@/lib/salonTeamRoles';
import { cn } from '@/lib/utils';

type RowState = {
  userId: string;
  fullName: string;
  roleLabel: string;
  color: string | null;
  nickname: string;
  sortOrder: number;
};

function toRows(members: SalonAgendaMemberSortable[]): RowState[] {
  return members.map((m, index) => ({
    userId: m.user_id,
    fullName: m.full_name?.trim() || 'Profissional',
    roleLabel: salonStaffRoleLabel(m.staff_title),
    color: m.agenda_label_color ?? null,
    nickname: m.agenda_label_nickname?.trim() ?? '',
    sortOrder: m.agenda_sort_order ?? index,
  }));
}

export function SalonAgendaProfessionalsOrderSection() {
  const queryClient = useQueryClient();
  const { organizationId } = useSalonAccount();
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  const teamQuery = useQuery({
    queryKey: salonAgendaTeamQueryKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: () => fetchSalonAgendaTeamMembers(organizationId!),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const bookableMembers = useMemo(() => {
    return sortSalonAgendaMembers((teamQuery.data ?? []).filter(isSalonAgendaBookableMember));
  }, [teamQuery.data]);

  useEffect(() => {
    if (!bookableMembers.length) return;
    if (dirtyRef.current || saving) return;
    setRows(toRows(bookableMembers));
  }, [bookableMembers, saving]);

  const persistRows = useCallback(
    async (nextRows: RowState[]) => {
      if (!organizationId) {
        toast.error('Organização do salão não encontrada.');
        return;
      }
      setSaving(true);
      try {
        const reloaded = await saveAndReloadSalonAgendaProfessionalsOrder(
          organizationId,
          nextRows.map((row, index) => ({
            user_id: row.userId,
            agenda_label_nickname: row.nickname.trim() || null,
            agenda_sort_order: index,
          }))
        );
        const nextBookable = sortSalonAgendaMembers(reloaded.filter(isSalonAgendaBookableMember));
        queryClient.setQueryData(salonAgendaTeamQueryKey(organizationId), reloaded);
        dirtyRef.current = false;
        setRows(toRows(nextBookable));
        toast.success('Ordem e apelidos da agenda salvos.');
      } catch (e) {
        dirtyRef.current = false;
        toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a ordem da agenda.');
        if (teamQuery.data) {
          setRows(toRows(sortSalonAgendaMembers(teamQuery.data.filter(isSalonAgendaBookableMember))));
        }
      } finally {
        setSaving(false);
      }
    },
    [organizationId, queryClient, teamQuery.data]
  );

  const scheduleSave = useCallback(
    (nextRows: RowState[]) => {
      dirtyRef.current = true;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        void persistRows(nextRows);
      }, 700);
    },
    [persistRows]
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    },
    []
  );

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setRows(next);
    scheduleSave(next);
  };

  const updateNickname = (userId: string, nickname: string) => {
    const next = rows.map((r) => (r.userId === userId ? { ...r, nickname } : r));
    setRows(next);
    scheduleSave(next);
  };

  const previewProfessionals = useMemo(
    () =>
      rows.map((row, index) =>
        mapSalonAgendaProfessional({
          user_id: row.userId,
          full_name: row.fullName,
          role: 'professional',
          agenda_label_nickname: row.nickname,
          agenda_label_color: row.color,
          agenda_sort_order: index,
        })
      ),
    [rows]
  );

  if (teamQuery.isLoading) {
    return <p className="text-xs text-muted-foreground">Carregando equipe...</p>;
  }

  if (teamQuery.isError) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 md:p-5">
        <p className="text-sm font-semibold tracking-tight">Agenda: ordem dos profissionais</p>
        <p className="text-xs text-destructive mt-1">
          {teamQuery.error instanceof Error
            ? teamQuery.error.message
            : 'Não foi possível carregar a equipe.'}
        </p>
      </div>
    );
  }

  if (bookableMembers.length < 2) {
    return (
      <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-muted/20 to-muted/10 p-4 md:p-5">
        <p className="text-sm font-semibold tracking-tight">Agenda: ordem dos profissionais</p>
        <p className="text-xs text-muted-foreground mt-1">
          Disponível quando houver mais de um profissional na equipe.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-muted/20 to-muted/10 p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold tracking-tight">Agenda: ordem dos profissionais</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defina a ordem das colunas na agenda e o apelido exibido em cada profissional.
          </p>
        </div>
        <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
          {saving ? 'Salvando...' : dirtyRef.current ? 'Alterações pendentes...' : 'Salvo'}
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={row.userId}
            className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background/70 p-3 sm:flex-row sm:items-end"
          >
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="text-sm font-medium truncate">{row.fullName}</p>
                  <p className="text-xs text-muted-foreground">{row.roleLabel}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`salon-agenda-nick-${row.userId}`} className="text-xs text-muted-foreground">
                    Apelido na agenda
                  </Label>
                  <Input
                    id={`salon-agenda-nick-${row.userId}`}
                    value={row.nickname}
                    placeholder={row.fullName.split(/\s+/)[0] || 'Apelido'}
                    disabled={saving}
                    onChange={(e) => updateNickname(row.userId, e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={saving || index === 0}
                aria-label={`Subir ${row.fullName}`}
                onClick={() => moveRow(index, -1)}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={saving || index === rows.length - 1}
                aria-label={`Descer ${row.fullName}`}
                onClick={() => moveRow(index, 1)}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Pré-visualização da agenda</p>
        <div
          className="grid gap-2 min-w-0"
          style={{ gridTemplateColumns: `repeat(${previewProfessionals.length}, minmax(0, 1fr))` }}
        >
          {previewProfessionals.map((pro) => (
            <div key={pro.userId} className="min-w-0 space-y-1">
              <div
                className="rounded-lg border bg-muted/40 px-2 py-1.5 text-center"
                style={
                  pro.color
                    ? { borderColor: `${pro.color}55`, backgroundColor: `${pro.color}12` }
                    : undefined
                }
              >
                <p
                  className="text-[11px] font-bold uppercase tracking-wide truncate"
                  style={pro.color ? { color: pro.color } : undefined}
                  title={pro.name}
                >
                  {pro.displayLabel}
                </p>
              </div>
              <div className="space-y-1">
                {[1, 2].map((slot) => (
                  <div
                    key={slot}
                    className={cn(
                      'h-7 rounded-md border border-border/60 bg-background/80',
                      slot === 1 && pro.color && 'border-l-[3px]'
                    )}
                    style={slot === 1 && pro.color ? { borderLeftColor: pro.color } : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Colunas da esquerda para a direita, como na agenda semanal do salão.
        </p>
      </div>
    </div>
  );
}
