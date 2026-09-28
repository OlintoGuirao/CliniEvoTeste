import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { BranchOperationalGuard } from '@/components/branch-operational/BranchOperationalGuard';
import { CaptureLeadDialog } from '@/components/branch-operational/CaptureLeadDialog';
import { JourneyPipelineCard } from '@/components/branch-operational/JourneyPipelineCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBranchBranding } from '@/hooks/use-branch-branding';
import {
  useBranchOperationalAccess,
  useBranchOperationalPipeline,
  useBranchPendingFollowUps,
} from '@/hooks/use-branch-operational';
import {
  COLUMN_TONE_CLASS,
  JOURNEY_CAPTURE_CHANNEL_LABELS,
  JOURNEY_STAGE_LABELS,
  PIPELINE_COLUMNS,
} from '@/lib/branchOperationalJourney';
import type { BranchOperationalFilters, JourneyCaptureChannel, JourneyStage } from '@/types/branchOperationalJourney';

function BranchOperationalPageContent() {
  const { branchId, profileId } = useBranchOperationalAccess();
  const { appName } = useBranchBranding();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [filters, setFilters] = useState<BranchOperationalFilters>({});

  const pipelineQuery = useBranchOperationalPipeline(filters);
  const followUpsQuery = useBranchPendingFollowUps();

  const followUpByJourney = useMemo(() => {
    const map = new Map<string, string>();
    for (const fu of followUpsQuery.data ?? []) {
      if (!map.has(fu.journey_id)) map.set(fu.journey_id, fu.due_at);
    }
    return map;
  }, [followUpsQuery.data]);

  const journeysByColumn = useMemo(() => {
    const journeys = pipelineQuery.data ?? [];
    return PIPELINE_COLUMNS.map((column) => ({
      column,
      items: journeys.filter((j) => column.stages.includes(j.current_stage)),
    }));
  }, [pipelineQuery.data]);

  if (!branchId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Sua conta não está vinculada a uma filial.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Operacional' },
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline operacional</h1>
          <p className="text-sm text-muted-foreground">
            Jornada do paciente na unidade {appName} — captação até pós-venda.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => pipelineQuery.refetch()} disabled={pipelineQuery.isFetching}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setCaptureOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo contato
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            type="date"
            aria-label="Data início"
            value={filters.dataInicio ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, dataInicio: e.target.value || undefined }))}
          />
          <Input
            type="date"
            aria-label="Data fim"
            value={filters.dataFim ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, dataFim: e.target.value || undefined }))}
          />
          <Select
            value={filters.stage ?? 'all'}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, stage: v === 'all' ? undefined : (v as JourneyStage) }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {Object.entries(JOURNEY_STAGE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.captureChannel ?? 'all'}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                captureChannel: v === 'all' ? undefined : (v as JourneyCaptureChannel),
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              {Object.entries(JOURNEY_CAPTURE_CHANNEL_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {pipelineQuery.isLoading ? (
        <PageSkeleton />
      ) : pipelineQuery.isError ? (
        <p className="text-sm text-destructive">
          {pipelineQuery.error instanceof Error ? pipelineQuery.error.message : 'Erro ao carregar pipeline.'}
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {journeysByColumn.map(({ column, items }) => (
            <section
              key={column.id}
              className={`min-w-[280px] max-w-[320px] shrink-0 rounded-xl border p-3 ${COLUMN_TONE_CLASS[column.tone]}`}
              aria-label={column.label}
            >
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{column.label}</h2>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium">{items.length}</span>
              </header>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum paciente nesta etapa.</p>
                ) : (
                  items.map((journey) => (
                    <JourneyPipelineCard
                      key={journey.id}
                      journey={journey}
                      followUpDueAt={followUpByJourney.get(journey.id)}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <CaptureLeadDialog
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        branchId={branchId}
        profileId={profileId}
      />
    </div>
  );
}

export default function BranchOperationalPage() {
  return (
    <BranchOperationalGuard>
      <BranchOperationalPageContent />
    </BranchOperationalGuard>
  );
}
