import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  PatientDetailNavTabs,
  type PatientDetailPageTab,
} from './PatientDetailNavTabs';

const DOC_ITEMS = [
  { key: 'anamnese' as const, label: 'Anamnese' },
  { key: 'lgpd' as const, label: 'LGPD' },
  { key: 'termoBotox' as const, label: 'Termo Toxina Botulínica' },
  { key: 'termoPreenchedores' as const, label: 'Termo Preenchedores' },
] as const;

function DocStatusChip({
  consentGiven,
  anamneseComplete,
  hasTermBotox,
  hasTermPreenchedores,
  showTermBotoxTab,
  showTermPreenchedoresTab,
}: {
  consentGiven: boolean;
  anamneseComplete: boolean;
  hasTermBotox: boolean;
  hasTermPreenchedores: boolean;
  showTermBotoxTab: boolean;
  showTermPreenchedoresTab: boolean;
}) {
  const docItems = DOC_ITEMS.filter((item) => {
    if (item.key === 'termoBotox') return showTermBotoxTab;
    if (item.key === 'termoPreenchedores') return showTermPreenchedoresTab;
    return true;
  });

  const status = {
    anamnese: anamneseComplete,
    lgpd: consentGiven,
    termoBotox: hasTermBotox,
    termoPreenchedores: hasTermPreenchedores,
  };
  const completed = docItems.filter((i) => status[i.key]).length;
  const allOk = completed === docItems.length;
  const someOk = completed > 0 && completed < docItems.length;

  const tooltipText = docItems.map((i) => `${status[i.key] ? '✓' : '✗'} ${i.label}`).join('\n');

  const chip = (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium"
      style={
        allOk
          ? { borderColor: 'hsl(var(--success))', color: 'hsl(var(--success))' }
          : someOk
            ? { borderColor: 'hsl(var(--warning))', color: 'hsl(var(--warning))' }
            : { borderColor: 'hsl(var(--destructive))', color: 'hsl(var(--destructive))' }
      }
    >
      {allOk && <CheckCircle2 className="h-3.5 w-3.5" />}
      {someOk && <AlertCircle className="h-3.5 w-3.5" />}
      {completed === 0 && <XCircle className="h-3.5 w-3.5" />}
      <span>Documentos</span>
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><span className="inline-flex cursor-default">{chip}</span></TooltipTrigger>
        <TooltipContent side="bottom" className="whitespace-pre-line text-left">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export interface PatientDetailHeaderProps {
  patientId: string;
  fullName: string;
  profilePhotoUrl: string | null;
  age: number | null;
  sexLabel: string;
  statusLabel: 'Ativo' | 'Em tratamento' | 'Finalizado';
  consentGiven: boolean;
  anamneseComplete: boolean;
  hasTermBotox: boolean;
  hasTermPreenchedores: boolean;
  showReceituario: boolean;
  showDentalPlans?: boolean;
  showTermBotoxTab: boolean;
  showTermPreenchedoresTab: boolean;
  activeTab: PatientDetailPageTab;
  onTabChange: (tab: PatientDetailPageTab) => void;
  tabsLocked?: boolean;
  onTabChangeBlocked?: () => void;
  isSalon?: boolean;
  /** Se informado, o botão voltar chama isso em vez de ir para /patients. */
  onBack?: () => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function PatientDetailHeader({
  patientId,
  fullName,
  profilePhotoUrl,
  age,
  sexLabel,
  statusLabel,
  consentGiven,
  anamneseComplete,
  hasTermBotox,
  hasTermPreenchedores,
  showReceituario,
  showDentalPlans = false,
  showTermBotoxTab,
  showTermPreenchedoresTab,
  activeTab,
  onTabChange,
  tabsLocked,
  onTabChangeBlocked,
  isSalon = false,
  onBack,
}: PatientDetailHeaderProps) {
  return (
    <header className="bg-card">
      <div className="p-3 md:p-5">
        <div className="flex items-start gap-2 md:gap-4">
          {onBack ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 h-10 w-10 md:h-10 md:w-10 min-h-[44px] min-w-[44px] rounded-xl touch-manipulation"
              title="Voltar"
              onClick={onBack}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 h-10 w-10 md:h-10 md:w-10 min-h-[44px] min-w-[44px] rounded-xl touch-manipulation"
              asChild
            >
              <Link to="/patients" title="Voltar">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
          )}
          <div className="min-w-0 flex-1 flex gap-3 md:gap-4">
            <Avatar className="h-12 w-12 md:h-14 md:w-14 shrink-0 ring-2 ring-border/60">
              <AvatarImage src={profilePhotoUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-base md:text-lg font-semibold">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-left">
              <h1
                className="text-base md:text-2xl font-bold text-foreground tracking-tight truncate md:break-words md:line-clamp-2"
                title={fullName}
              >
                {fullName}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1.5 text-xs md:text-sm text-muted-foreground">
                {age != null && <span>{age} anos</span>}
                {age != null && sexLabel && <span aria-hidden>·</span>}
                {sexLabel && <span>{sexLabel}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-1.5 md:gap-2 mt-2 md:mt-3">
          <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] md:text-xs font-medium text-foreground shrink-0">
            {statusLabel}
          </span>
          <span className="inline-flex shrink-0">
            {!isSalon ? (
            <DocStatusChip
              consentGiven={consentGiven}
              anamneseComplete={anamneseComplete}
              hasTermBotox={hasTermBotox}
              hasTermPreenchedores={hasTermPreenchedores}
              showTermBotoxTab={showTermBotoxTab}
              showTermPreenchedoresTab={showTermPreenchedoresTab}
            />
            ) : null}
          </span>
        </div>
      </div>

      <PatientDetailNavTabs
        patientId={patientId}
        activeTab={activeTab}
        onTabChange={onTabChange}
        showReceituario={showReceituario}
        showDentalPlans={showDentalPlans}
        showTermBotoxTab={showTermBotoxTab}
        showTermPreenchedoresTab={showTermPreenchedoresTab}
        anamneseComplete={anamneseComplete}
        consentGiven={consentGiven}
        hasTermBotox={hasTermBotox}
        hasTermPreenchedores={hasTermPreenchedores}
        tabsLocked={tabsLocked}
        onTabChangeBlocked={onTabChangeBlocked}
        isSalon={isSalon}
      />
    </header>
  );
}

export type { PatientDetailPageTab };
