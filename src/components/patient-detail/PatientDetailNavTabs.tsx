import { Link } from 'react-router-dom';
import {
  User,
  FileText,
  FlaskConical,
  FilePenLine,
  Shield,
  PenLine,
  Stethoscope,
  CalendarClock,
  CheckCircle2,
  Smile,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type PatientDetailPageTab =
  | 'ficha'
  | 'procedimentos'
  | 'anamnese'
  | 'exames'
  | 'receituario'
  | 'planos-odontologicos'
  | 'documentos'
  | 'lgpd'
  | 'termo-botox'
  | 'termo-preenchedores'
  | 'agenda-fixa';

type TabItem =
  | {
      kind: 'page';
      id: PatientDetailPageTab;
      label: string;
      shortLabel: string;
      icon: LucideIcon;
      done?: boolean;
    }
  | {
      kind: 'link';
      href: string;
      label: string;
      shortLabel: string;
      icon: LucideIcon;
      done?: boolean;
    };

export type PatientDetailNavTabsProps = {
  patientId: string;
  activeTab: PatientDetailPageTab;
  onTabChange: (tab: PatientDetailPageTab) => void;
  showReceituario: boolean;
  showDentalPlans: boolean;
  showTermBotoxTab: boolean;
  showTermPreenchedoresTab: boolean;
  anamneseComplete: boolean;
  consentGiven: boolean;
  hasTermBotox: boolean;
  hasTermPreenchedores: boolean;
  tabsLocked?: boolean;
  onTabChangeBlocked?: () => void;
  /** Salão: só Procedimentos + Informações pessoais. */
  isSalon?: boolean;
};

const browserTabBase = cn(
  'relative inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border px-3 py-2 md:px-4 md:py-2.5',
  'text-xs md:text-sm font-medium transition-all min-h-[40px] md:min-h-[42px] touch-manipulation',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
);

const browserTabInactive = cn(
  browserTabBase,
  'border-transparent border-b-border bg-muted/55 text-muted-foreground',
  'hover:bg-muted/80 hover:text-foreground'
);

const browserTabActive = cn(
  browserTabBase,
  'z-10 -mb-px border-border border-b-card bg-card text-foreground',
  'shadow-[0_1px_0_0_hsl(var(--card))]'
);

function TabDoneBadge() {
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-label="Concluído" />;
}

function TabLabels({ label, shortLabel }: { label: string; shortLabel: string }) {
  return (
    <>
      <span className="hidden lg:inline max-w-[11rem] truncate">{label}</span>
      <span className="lg:hidden max-w-[5.5rem] truncate">{shortLabel}</span>
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
  shortLabel,
  icon: Icon,
  done,
  showDivider,
  locked,
  onLockedClick,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  done?: boolean;
  showDivider?: boolean;
  locked?: boolean;
  onLockedClick?: () => void;
}) {
  const isBlocked = locked && !active;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-disabled={isBlocked}
      onClick={() => {
        if (isBlocked) {
          onLockedClick?.();
          return;
        }
        onClick();
      }}
      className={cn(
        active ? browserTabActive : browserTabInactive,
        isBlocked && 'opacity-50 cursor-not-allowed hover:bg-muted/55 hover:text-muted-foreground',
        !active && showDivider && 'before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-border/70'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <TabLabels label={label} shortLabel={shortLabel} />
      {done ? <TabDoneBadge /> : null}
    </button>
  );
}

function TabLink({
  href,
  label,
  shortLabel,
  icon: Icon,
  done,
  showDivider,
  locked,
  onLockedClick,
}: {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  done?: boolean;
  showDivider?: boolean;
  locked?: boolean;
  onLockedClick?: () => void;
}) {
  if (locked) {
    return (
      <button
        type="button"
        role="tab"
        aria-disabled
        onClick={() => onLockedClick?.()}
        className={cn(
          browserTabInactive,
          'opacity-50 cursor-not-allowed hover:bg-muted/55 hover:text-muted-foreground',
          showDivider && 'before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-border/70'
        )}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <TabLabels label={label} shortLabel={shortLabel} />
        {done ? <TabDoneBadge /> : null}
      </button>
    );
  }

  return (
    <Link
      to={href}
      role="tab"
      className={cn(
        browserTabInactive,
        showDivider && 'before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-border/70'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <TabLabels label={label} shortLabel={shortLabel} />
      {done ? <TabDoneBadge /> : null}
    </Link>
  );
}

export function PatientDetailNavTabs({
  patientId,
  activeTab,
  onTabChange,
  showReceituario,
  showDentalPlans,
  showTermBotoxTab,
  showTermPreenchedoresTab,
  anamneseComplete,
  consentGiven,
  hasTermBotox,
  hasTermPreenchedores,
  tabsLocked = false,
  onTabChangeBlocked,
  isSalon = false,
}: PatientDetailNavTabsProps) {
  const items: TabItem[] = isSalon
    ? [
        {
          kind: 'page',
          id: 'procedimentos',
          label: 'Procedimentos',
          shortLabel: 'Proced.',
          icon: Stethoscope,
        },
        {
          kind: 'page',
          id: 'ficha',
          label: 'Informações pessoais',
          shortLabel: 'Ficha',
          icon: User,
        },
        {
          kind: 'page',
          id: 'agenda-fixa',
          label: 'Agenda fixa',
          shortLabel: 'Agenda',
          icon: CalendarClock,
        },
      ]
    : [
    {
      kind: 'page',
      id: 'procedimentos',
      label: 'Procedimentos',
      shortLabel: 'Proced.',
      icon: Stethoscope,
    },
    {
      kind: 'page',
      id: 'ficha',
      label: 'Informações pessoais',
      shortLabel: 'Ficha',
      icon: User,
    },
    {
      kind: 'page',
      id: 'anamnese',
      label: 'Anamnese',
      shortLabel: 'Anamnese',
      icon: FileText,
      done: anamneseComplete,
    },
    {
      kind: 'page',
      id: 'exames',
      label: 'Exames',
      shortLabel: 'Exames',
      icon: FlaskConical,
    },
    ...(showReceituario
      ? [
          {
            kind: 'page' as const,
            id: 'receituario' as const,
            label: 'Receituário',
            shortLabel: 'Receita',
            icon: FilePenLine,
          },
        ]
      : []),
    ...(showDentalPlans
      ? [
          {
            kind: 'page' as const,
            id: 'planos-odontologicos' as const,
            label: 'Planos odontológicos',
            shortLabel: 'Odonto',
            icon: Smile,
          },
          {
            kind: 'page' as const,
            id: 'documentos' as const,
            label: 'Documentos',
            shortLabel: 'Docs',
            icon: FolderOpen,
          },
        ]
      : []),
    {
      kind: 'page',
      id: 'lgpd',
      label: 'LGPD',
      shortLabel: 'LGPD',
      icon: Shield,
      done: consentGiven,
    },
    ...(showTermBotoxTab
      ? [
          {
            kind: 'page' as const,
            id: 'termo-botox' as const,
            label: 'Termo Toxina Botulínica',
            shortLabel: 'Botox',
            icon: PenLine,
            done: hasTermBotox,
          },
        ]
      : []),
    ...(showTermPreenchedoresTab
      ? [
          {
            kind: 'page' as const,
            id: 'termo-preenchedores' as const,
            label: 'Termo Preenchedores',
            shortLabel: 'Preenchedores',
            icon: PenLine,
            done: hasTermPreenchedores,
          },
        ]
      : []),
  ];

  return (
    <nav className="mt-3 md:mt-4 border-t border-border/60" aria-label="Seções da ficha do paciente">
      <div className="bg-muted/35 border-b border-border/70 px-1.5 pt-1.5 md:px-2 md:pt-2">
        <div className="overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full items-end gap-0.5 pr-1" role="tablist">
            {items.map((item, index) => {
              const showDivider = index > 0;
              if (item.kind === 'page') {
                return (
                  <TabButton
                    key={item.id}
                    active={activeTab === item.id}
                    onClick={() => onTabChange(item.id)}
                    label={item.label}
                    shortLabel={item.shortLabel}
                    icon={item.icon}
                    done={item.done}
                    showDivider={showDivider && activeTab !== item.id}
                    locked={tabsLocked}
                    onLockedClick={onTabChangeBlocked}
                  />
                );
              }
              return (
                <TabLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  shortLabel={item.shortLabel}
                  icon={item.icon}
                  done={item.done}
                  showDivider={showDivider}
                  locked={tabsLocked}
                  onLockedClick={onTabChangeBlocked}
                />
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
