import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  ChevronRight,
  MoreVertical,
  Pencil,
  Plus,
  User,
  Users,
  Wallet,
  BarChart3,
  Package,
  Building2,
  UsersRound,
  Stethoscope,
  MessageCircle,
  Headset,
  Share2,
  ClipboardList,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import type { ConsultationTodayItem } from '@/api/dashboard';
import { patientInitials } from '@/lib/dashboardHelpers';
import { formatPersonName, cn } from '@/lib/utils';
import { CLINIC_MASTER_DASHBOARD_ACTIONS } from '@/lib/clinicMasterNav';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { SalonAppointmentEditDialog } from '@/components/dashboard/SalonAppointmentEditDialog';

const MASTER_ACTION_ICONS = {
  '/faturamento': Wallet,
  '/fluxo-caixa': BarChart3,
  '/insumos-nf': Package,
  '/settings/filiais': Building2,
  '/settings/equipe': UsersRound,
  '/settings/procedimentos': Stethoscope,
  '/settings/origens': Share2,
  '/settings/tipos-ficha': ClipboardList,
} as const;

export function DashboardMasterQuickActions() {
  const copy = useUiCopy();
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
      {CLINIC_MASTER_DASHBOARD_ACTIONS.map((action) => {
        const { href } = action;
        const label = 'labelKey' in action && action.labelKey === 'team' ? copy.team : action.label;
        const Icon = MASTER_ACTION_ICONS[href];
        return (
          <Link key={href} to={href} className="min-w-0 min-h-[48px]">
            <Button
              variant="outline"
              className={cn(
                'h-12 w-full gap-2 rounded-xl px-3 touch-manipulation text-sm font-medium justify-start',
                'sm:px-3.5 lg:px-4',
                '[&_svg]:!h-[18px] [&_svg]:!w-[18px]'
              )}
            >
              <Icon className="shrink-0" />
              <span className="min-w-0 truncate">{label}</span>
            </Button>
          </Link>
        );
      })}
    </div>
  );
}

export function ClinicFrontDeskQuickActions() {
  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <Button
        variant="default"
        size="sm"
        className="h-9 gap-1.5 rounded-lg px-3 text-xs sm:text-sm font-medium bg-emerald-600 hover:bg-emerald-700"
        asChild
      >
        <Link to="/atendimento">
          <Headset className="shrink-0 h-3.5 w-3.5" />
          <span className="truncate">Atendimento WhatsApp</span>
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 rounded-lg px-3 text-xs sm:text-sm font-medium"
        asChild
      >
        <Link to="/agenda">
          <Calendar className="shrink-0 h-3.5 w-3.5" />
          <span className="truncate">Agenda</span>
        </Link>
      </Button>
    </div>
  );
}

export function DashboardQuickActions() {
  const copy = useUiCopy();
  const actions = [
    { href: '/consultation', label: copy.newConsultation, icon: Plus },
    { href: '/patients/new', label: copy.isSalon ? 'Novo cliente' : 'Novo paciente', icon: Users },
    { href: '/agenda', label: 'Agenda', icon: Calendar },
    { href: '/patients', label: copy.patients, icon: Users },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      {actions.map(({ href, label, icon: Icon }) => (
        <Link key={href} to={href} className="min-w-0 min-h-[48px]">
          <Button
            variant="outline"
            className={cn(
              'h-12 w-full gap-2 rounded-xl px-3 touch-manipulation text-sm font-medium',
              'sm:px-3.5 lg:px-4',
              '[&_svg]:!h-[18px] [&_svg]:!w-[18px]'
            )}
          >
            <Icon className="shrink-0" />
            <span className="min-w-0 truncate">{label}</span>
          </Button>
        </Link>
      ))}
    </div>
  );
}

export function DashboardMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  onClick,
  link,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  link?: string;
}) {
  const inner = (
    <Card className="h-full border-border/80 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99]">
      <CardContent
        className={cn(
          'flex h-full min-h-[88px] items-center gap-3 p-3.5 text-left',
          // No tablet (3 cards estreitos) empilha ícone + texto no centro
          'sm:min-h-[124px] sm:flex-col sm:items-center sm:justify-center sm:gap-2 sm:p-4 sm:text-center',
          '2xl:min-h-[148px] 2xl:gap-0 2xl:p-5'
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 sm:mb-0.5 2xl:mb-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 sm:w-full sm:flex-none">
          <p className="text-[10px] font-semibold uppercase leading-snug tracking-wide text-primary sm:text-[11px] sm:leading-tight">
            {title}
          </p>
          <p className="mt-1 text-xl font-bold leading-none tabular-nums text-foreground sm:mt-1.5 sm:text-2xl 2xl:mt-2 2xl:text-3xl">
            {value}
          </p>
          {subtitle ? (
            <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground sm:mt-1">
              {subtitle}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  const wrapperClass = 'block w-full h-full touch-manipulation';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${wrapperClass} text-left`}>
        {inner}
      </button>
    );
  }
  if (link) {
    return (
      <Link to={link} className={wrapperClass}>
        {inner}
      </Link>
    );
  }
  return inner;
}

export function NextAppointmentCard({
  appointment,
  todayStr,
  detailHref,
  showProfessional,
  compact,
  frontDeskMode,
  onWhatsApp,
  whatsappLoading,
  onAttend,
}: {
  appointment: ConsultationTodayItem;
  todayStr: string;
  detailHref: string;
  showProfessional?: boolean;
  compact?: boolean;
  /** Recepção da clínica: Atender (plano) + WhatsApp */
  frontDeskMode?: boolean;
  onWhatsApp?: () => void;
  whatsappLoading?: boolean;
  /** Recepção clínica: abre atendimento / plano odontológico */
  onAttend?: () => void;
}) {
  const copy = useUiCopy();
  const isToday = appointment.date === todayStr;
  const dateLabel = format(parseISO(appointment.date), "d 'de' MMM", { locale: ptBR });

  return (
    <Card className="h-full overflow-hidden border-2 border-primary/35 shadow-md ring-1 ring-primary/15 bg-gradient-to-br from-primary/[0.12] via-card to-card">
      <CardContent
        className={cn(
          'flex h-full flex-col gap-4',
          compact
            ? 'min-h-[168px] p-4 md:min-h-[160px] md:p-5'
            : 'min-h-[168px] p-5 md:min-h-[160px] md:p-6 2xl:min-h-[184px] 2xl:p-7'
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3.5 md:gap-4">
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/20',
              compact ? 'h-11 w-11' : 'h-12 w-12 md:h-14 md:w-14'
            )}
          >
            <Calendar
              className={cn('text-primary', compact ? 'h-5 w-5' : 'h-6 w-6 md:h-7 md:w-7')}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary md:text-xs">
              {copy.nextConsultation}
            </p>

            <div className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <p
                className={cn(
                  'shrink-0 font-bold leading-none tabular-nums text-primary',
                  compact ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl 2xl:text-[2.75rem]'
                )}
              >
                {appointment.time}
              </p>
              {!isToday ? (
                <p className="shrink-0 whitespace-nowrap text-sm font-medium text-muted-foreground md:text-base">
                  {dateLabel}
                </p>
              ) : null}
            </div>

            {showProfessional && appointment.professionalName ? (
              <div className={cn(compact ? 'mt-2' : 'mt-3 md:mt-4 2xl:mt-5')}>
                <p className="text-xs text-muted-foreground md:text-sm">Profissional:</p>
                <p className="mt-0.5 line-clamp-2 break-words text-sm font-semibold text-foreground md:text-base">
                  {appointment.professionalName}
                </p>
              </div>
            ) : null}

            <div className={cn(showProfessional && appointment.professionalName ? 'mt-2' : compact ? 'mt-2' : 'mt-3 md:mt-4 2xl:mt-5')}>
              <p className="text-xs text-muted-foreground md:text-sm">{copy.patient}:</p>
              <p
                className={cn(
                  'mt-0.5 line-clamp-2 break-words font-bold text-foreground',
                  compact ? 'text-sm md:text-base' : 'text-base md:text-lg'
                )}
              >
                {formatPersonName(appointment.patientName)}
              </p>
            </div>

            <div className="mt-2">
              <p className="text-xs text-muted-foreground md:text-sm">Procedimento:</p>
              <p className="mt-0.5 line-clamp-2 break-words text-sm font-medium text-foreground/80 md:text-base">
                {appointment.procedureLabel ?? copy.consultation}
              </p>
            </div>
          </div>
        </div>

        {!appointment.isCompleted ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
            {frontDeskMode ? (
              <>
                {onAttend ? (
                  <Button
                    type="button"
                    className="min-h-[44px] w-full rounded-lg px-6 font-semibold shadow-sm touch-manipulation sm:w-auto"
                    onClick={onAttend}
                  >
                    <Stethoscope className="mr-2 h-4 w-4" />
                    Atender
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] w-full rounded-lg border-emerald-400/60 bg-background/80 px-6 font-semibold text-emerald-800 shadow-sm touch-manipulation hover:bg-emerald-50 sm:w-auto dark:text-emerald-300"
                  disabled={whatsappLoading}
                  onClick={onWhatsApp}
                >
                  <MessageCircle className="mr-2 h-4 w-4 text-[#25D366]" />
                  {whatsappLoading ? 'Abrindo...' : 'WhatsApp'}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="min-h-[44px] w-full rounded-lg border-primary/50 bg-background/80 px-6 font-semibold text-primary shadow-sm touch-manipulation hover:bg-primary/10 hover:text-primary sm:w-auto"
                asChild
              >
                <Link to={detailHref}>Iniciar</Link>
              </Button>
            )}
          </div>
        ) : appointment.patientId ? (
          <div className="flex w-full shrink-0 md:justify-end">
            <Button
              variant="outline"
              className="min-h-[44px] w-full rounded-lg px-6 font-semibold touch-manipulation md:w-auto"
              asChild
            >
              <Link to={`/patients/${appointment.patientId}`}>Ver ficha</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AppointmentMobileRow({
  item,
  rowHref,
  isHighlight,
  showProfessional,
  frontDeskMode,
  onWhatsApp,
}: {
  item: ConsultationTodayItem;
  rowHref: string;
  isHighlight: boolean;
  showProfessional?: boolean;
  frontDeskMode?: boolean;
  onWhatsApp?: () => void;
}) {
  if (frontDeskMode && item.type === 'appointment' && !item.isCompleted) {
    return (
      <button
        type="button"
        onClick={onWhatsApp}
        className={cn(
          'flex w-full items-center gap-3 p-3.5 sm:p-4 min-h-[64px] touch-manipulation transition-colors text-left',
          item.isCompleted
            ? 'bg-emerald-500/[0.08]'
            : 'hover:bg-muted/40 active:bg-muted/60',
          isHighlight && !item.isCompleted && 'bg-primary/5'
        )}
      >
        <div
          className={cn(
            'flex flex-col items-center justify-center w-14 shrink-0 rounded-lg py-1.5',
            isHighlight ? 'bg-primary/10' : 'bg-muted/50'
          )}
        >
          <span className={cn('text-sm font-bold tabular-nums', isHighlight ? 'text-primary' : 'text-foreground')}>
            {item.time}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground break-words line-clamp-2">{formatPersonName(item.patientName)}</p>
          {item.procedureLabel ? (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.procedureLabel}</p>
          ) : null}
        </div>
        <MessageCircle className="h-5 w-5 shrink-0 text-[#25D366]" aria-hidden />
      </button>
    );
  }

  return (
    <Link
      to={rowHref}
      className={cn(
        'flex items-center gap-3 p-3.5 sm:p-4 min-h-[64px] touch-manipulation transition-colors',
        item.isCompleted
          ? 'bg-emerald-500/[0.08] hover:bg-emerald-500/12 active:bg-emerald-500/15'
          : 'hover:bg-muted/40 active:bg-muted/60',
        isHighlight && !item.isCompleted && 'bg-primary/5'
      )}
    >
      <div
        className={cn(
          'flex flex-col items-center justify-center w-14 shrink-0 rounded-lg py-1.5',
          item.isCompleted
            ? 'bg-emerald-500/15'
            : isHighlight
              ? 'bg-primary/10'
              : 'bg-muted/50'
        )}
      >
        {isHighlight && !item.isCompleted ? (
          <span className="h-1.5 w-1.5 rounded-full bg-primary mb-0.5" aria-hidden />
        ) : item.isCompleted ? (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mb-0.5" aria-hidden />
        ) : null}
        <span
          className={cn(
            'text-sm font-bold tabular-nums',
            item.isCompleted
              ? 'text-emerald-700 dark:text-emerald-400'
              : isHighlight
                ? 'text-primary'
                : 'text-foreground'
          )}
        >
          {item.time}
        </span>
      </div>

      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
          {patientInitials(item.patientName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground break-words line-clamp-2 leading-snug">
          {formatPersonName(item.patientName)}
        </p>
        {item.patientAge != null ? (
          <p className="text-xs text-muted-foreground mt-0.5">{item.patientAge} anos</p>
        ) : null}
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {item.procedureLabel ?? 'Consulta'}
        </p>
        {showProfessional && item.professionalName ? (
          <p className="text-xs text-muted-foreground/90 mt-0.5 line-clamp-1">
            {item.professionalName}
          </p>
        ) : null}
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" aria-hidden />
    </Link>
  );
}

function SalonAppointmentDialogCardMeta({
  item,
}: {
  item: ConsultationTodayItem;
}) {
  return (
    <>
      <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
        {item.procedureLabel ?? '—'}
      </p>
      {item.professionalName ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Profissional:{' '}
          <span className="font-medium text-foreground/90">{item.professionalName}</span>
        </p>
      ) : null}
      {item.valorLine ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Valor: <span className="font-medium text-foreground">{item.valorLine}</span>
        </p>
      ) : null}
      {item.isCompleted ? (
        <p className="mt-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Concluído</p>
      ) : null}
    </>
  );
}

function SalonAppointmentDialogCard({
  item,
  onNavigate,
  onEdit,
  showEdit,
  isTodayHighlight,
  dateLabel,
}: {
  item: ConsultationTodayItem;
  onNavigate: () => void;
  onEdit: () => void;
  showEdit?: boolean;
  isTodayHighlight?: boolean;
  dateLabel?: React.ReactNode;
}) {
  const canEdit = showEdit && !item.isCompleted && item.type === 'appointment';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onNavigate();
        }
      }}
      className={cn(
        'rounded-xl border border-border/80 bg-card p-3.5 text-left w-full',
        'transition-colors touch-manipulation cursor-pointer',
        item.isCompleted
          ? 'border-emerald-500/40 bg-emerald-500/[0.08] hover:bg-emerald-500/12 active:bg-emerald-500/15'
          : 'hover:bg-muted/40 active:bg-muted/60',
        !item.isCompleted && isTodayHighlight && 'border-primary/35 bg-primary/[0.04]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm text-foreground break-words min-w-0">
          {formatPersonName(item.patientName)}
        </p>
        <div className="shrink-0 flex items-start gap-1.5">
          {canEdit ? (
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-sm hover:bg-primary/20 hover:border-primary/50 active:scale-95 touch-manipulation transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label="Editar atendimento"
            >
              <Pencil className="h-4 w-4" />
            </button>
          ) : null}
          <span
            className={cn(
              'text-xs font-semibold tabular-nums text-right pt-0.5',
              item.isCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
            )}
          >
            {dateLabel ?? item.time}
          </span>
        </div>
      </div>
      <SalonAppointmentDialogCardMeta item={item} />
    </div>
  );
}

export function SalonUpcomingAppointmentsDialog({
  open,
  onOpenChange,
  items,
  todayStr,
  showEdit,
  professionalId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ConsultationTodayItem[];
  todayStr: string;
  showEdit?: boolean;
  professionalId?: string;
}) {
  const navigate = useNavigate();
  const copy = useUiCopy();
  const [editItem, setEditItem] = useState<ConsultationTodayItem | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[min(85vh,100dvh)] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {copy.nextConsultations}
            </DialogTitle>
            <DialogDescription>
              Próximos 7 dias em todo o salão — cliente, procedimento e profissional.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum atendimento agendado nos próximos 7 dias.
              </p>
            ) : (
              <ul className="space-y-2 py-1">
                {items.map((item) => {
                  const rowHref =
                    item.type === 'session' ? `/patients/${item.patientId}` : item.href;
                  const isToday = item.date === todayStr;
                  return (
                    <li key={item.type === 'appointment' ? `upcoming-${item.id}` : `upcoming-s-${item.id}`}>
                      <SalonAppointmentDialogCard
                        item={item}
                        showEdit={showEdit}
                        isTodayHighlight={isToday}
                        dateLabel={
                          <>
                            {format(parseISO(item.date), "d 'de' MMM", { locale: ptBR })}
                            <span className="block">{item.time}</span>
                          </>
                        }
                        onNavigate={() => {
                          onOpenChange(false);
                          navigate(rowHref);
                        }}
                        onEdit={() => setEditItem(item)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SalonAppointmentEditDialog
        item={editItem}
        open={editItem != null}
        onOpenChange={(next) => {
          if (!next) setEditItem(null);
        }}
        professionalId={professionalId}
      />
    </>
  );
}

export function SalonTodayAppointmentsDialog({
  open,
  onOpenChange,
  items,
  todayStr,
  showEdit,
  professionalId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ConsultationTodayItem[];
  todayStr: string;
  showEdit?: boolean;
  professionalId?: string;
}) {
  const navigate = useNavigate();
  const copy = useUiCopy();
  const todayItems = items.filter((item) => item.date === todayStr);
  const [editItem, setEditItem] = useState<ConsultationTodayItem | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[min(85vh,100dvh)] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {copy.consultationsToday}
            </DialogTitle>
            <DialogDescription>
              Atendimentos de hoje em todo o salão — cliente, procedimento e profissional.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {todayItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum atendimento agendado para hoje.
              </p>
            ) : (
              <ul className="space-y-2 py-1">
                {todayItems.map((item) => {
                  const rowHref =
                    item.type === 'session' ? `/patients/${item.patientId}` : item.href;
                  return (
                    <li key={item.type === 'appointment' ? `today-${item.id}` : `today-s-${item.id}`}>
                      <SalonAppointmentDialogCard
                        item={item}
                        showEdit={showEdit}
                        onNavigate={() => {
                          onOpenChange(false);
                          navigate(rowHref);
                        }}
                        onEdit={() => setEditItem(item)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SalonAppointmentEditDialog
        item={editItem}
        open={editItem != null}
        onOpenChange={(next) => {
          if (!next) setEditItem(null);
        }}
        professionalId={professionalId}
      />
    </>
  );
}

export function TodayAppointmentsTable({
  items,
  highlightTime,
  todayStr,
  showProfessional,
  frontDeskMode,
  onWhatsAppAppointment,
}: {
  items: ConsultationTodayItem[];
  highlightTime: string | null;
  todayStr: string;
  showProfessional?: boolean;
  frontDeskMode?: boolean;
  onWhatsAppAppointment?: (item: ConsultationTodayItem) => void;
}) {
  const navigate = useNavigate();
  const copy = useUiCopy();

  return (
    <Card className="border-border/80 shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:p-5 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-semibold text-foreground">
            {copy.isSalon ? 'Atendimentos de hoje' : 'Consultas de hoje'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Agenda do dia</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto rounded-lg gap-2 shrink-0 min-h-[40px] touch-manipulation"
          asChild
        >
          <Link to="/agenda">
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">Ver agenda</span>
            <span className="hidden sm:inline">Ver agenda completa</span>
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 sm:py-12 px-4 text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium text-foreground">
            {copy.isSalon ? 'Nenhum atendimento hoje' : 'Nenhuma consulta hoje'}
          </p>
          <p className="text-xs mt-2">
            {frontDeskMode ? (
              <Link to="/agenda" className="text-primary underline touch-manipulation">
                Ver agenda completa
              </Link>
            ) : (
              <Link to="/consultation" className="text-primary underline touch-manipulation">
                {copy.isSalon ? 'Iniciar novo atendimento' : 'Iniciar nova consulta'}
              </Link>
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden 2xl:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[88px]">Horário</TableHead>
                  <TableHead className="min-w-[180px]">Paciente</TableHead>
                  <TableHead className="min-w-[140px]">Procedimento</TableHead>
                  {showProfessional ? (
                    <TableHead className="min-w-[120px]">Profissional</TableHead>
                  ) : null}
                  <TableHead className="w-[48px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isHighlight =
                    item.type === 'appointment' &&
                    item.date === todayStr &&
                    highlightTime != null &&
                    item.time === highlightTime &&
                    !item.isCompleted;
                  const rowHref =
                    item.type === 'session' ? `/patients/${item.patientId}` : item.href;
                  const openRow = () => {
                    if (frontDeskMode && item.type === 'appointment' && !item.isCompleted) {
                      onWhatsAppAppointment?.(item);
                      return;
                    }
                    navigate(rowHref);
                  };
                  return (
                    <TableRow
                      key={item.type === 'appointment' ? `appt-${item.id}` : `sess-${item.id}`}
                      className={cn(
                        'cursor-pointer hover:bg-muted/50',
                        isHighlight && 'bg-primary/5',
                        item.isCompleted && 'bg-emerald-500/[0.08] hover:bg-emerald-500/12'
                      )}
                      onClick={openRow}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isHighlight ? (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden />
                          ) : (
                            <span className="h-2 w-2 shrink-0" aria-hidden />
                          )}
                          <span
                            className={cn(
                              'font-semibold tabular-nums',
                              item.isCompleted
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : isHighlight
                                  ? 'text-primary'
                                  : 'text-foreground'
                            )}
                          >
                            {item.time}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {patientInitials(item.patientName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {formatPersonName(item.patientName)}
                            </p>
                            {item.patientAge != null ? (
                              <p className="text-xs text-muted-foreground">{item.patientAge} anos</p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[220px]">
                        <p className="truncate" title={item.procedureLabel ?? undefined}>
                          {item.procedureLabel ?? '—'}
                        </p>
                      </TableCell>
                      {showProfessional ? (
                        <TableCell className="text-muted-foreground max-w-[160px]">
                          <p className="truncate" title={item.professionalName ?? undefined}>
                            {item.professionalName ?? '—'}
                          </p>
                        </TableCell>
                      ) : null}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <RowActions item={item} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Tablet: tabela compacta com scroll horizontal */}
          <div className="hidden md:block 2xl:hidden overflow-x-auto -mx-px">
            <Table className="min-w-[520px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[72px]">Hora</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Procedimento</TableHead>
                  {showProfessional ? <TableHead>Profissional</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isHighlight =
                    item.type === 'appointment' &&
                    item.date === todayStr &&
                    highlightTime != null &&
                    item.time === highlightTime &&
                    !item.isCompleted;
                  const rowHref =
                    item.type === 'session' ? `/patients/${item.patientId}` : item.href;
                  const openRow = () => {
                    if (frontDeskMode && item.type === 'appointment' && !item.isCompleted) {
                      onWhatsAppAppointment?.(item);
                      return;
                    }
                    navigate(rowHref);
                  };
                  return (
                    <TableRow
                      key={`tab-${item.type === 'appointment' ? item.id : `s-${item.id}`}`}
                      className={cn(
                        'cursor-pointer',
                        isHighlight && 'bg-primary/5',
                        item.isCompleted && 'bg-emerald-500/[0.08] hover:bg-emerald-500/12'
                      )}
                      onClick={openRow}
                    >
                      <TableCell
                        className={cn(
                          'font-semibold tabular-nums',
                          item.isCompleted
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : isHighlight
                              ? 'text-primary'
                              : ''
                        )}
                      >
                        {item.time}
                      </TableCell>
                      <TableCell className="font-medium max-w-[140px] truncate">
                        {formatPersonName(item.patientName)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[160px] truncate text-xs">
                        {item.procedureLabel}
                      </TableCell>
                      {showProfessional ? (
                        <TableCell className="text-muted-foreground max-w-[120px] truncate text-xs">
                          {item.professionalName ?? '—'}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden divide-y divide-border/60">
            {items.map((item) => {
              const isHighlight =
                item.type === 'appointment' &&
                item.date === todayStr &&
                highlightTime != null &&
                item.time === highlightTime &&
                !item.isCompleted;
              const rowHref = item.type === 'session' ? `/patients/${item.patientId}` : item.href;
              return (
                <AppointmentMobileRow
                  key={item.type === 'appointment' ? `appt-m-${item.id}` : `sess-m-${item.id}`}
                  item={item}
                  rowHref={rowHref}
                  isHighlight={isHighlight}
                  showProfessional={showProfessional}
                  frontDeskMode={frontDeskMode}
                  onWhatsApp={() => onWhatsAppAppointment?.(item)}
                />
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function RowActions({ item }: { item: ConsultationTodayItem }) {
  if (!item.patientId) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 touch-manipulation">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={`/patients/${item.patientId}`}>Ver ficha</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EmptyNextAppointmentCard() {
  const copy = useUiCopy();
  return (
    <Card className="h-full min-h-[168px] border-2 border-dashed border-primary/35 bg-gradient-to-br from-primary/[0.08] via-muted/20 to-card shadow-sm">
      <CardContent className="p-5 md:p-7 flex flex-col items-center justify-center text-center min-h-[168px] md:min-h-[184px]">
        <Calendar className="w-10 h-10 text-muted-foreground/50 mb-2" />
        <p className="text-sm font-medium text-foreground">
          {copy.isSalon ? 'Nenhum atendimento agendado' : 'Nenhuma consulta agendada'}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 text-xs">
          <Link to="/agenda" className="text-primary underline touch-manipulation min-h-[44px] flex items-center justify-center">
            Ver agenda
          </Link>
          <span className="hidden sm:inline text-muted-foreground">·</span>
          <Link
            to="/consultation"
            className="text-primary underline touch-manipulation min-h-[44px] flex items-center justify-center"
          >
            {copy.newConsultation}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
