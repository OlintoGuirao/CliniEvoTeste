import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminStats, fetchAdminDashboardInsights, fetchAdminActivityLog } from '@/services/api/adminApi';
import type { AdminStats, DashboardInsights, AdminActivityEntry } from '@/services/api/adminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, UserX, Sliders, Loader2, UserPlus, BarChart3, Activity } from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ADMIN_EMAIL = 'admin@clinievo.com.br';

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

function formatActivity(action: string, entity_type: string, details: Record<string, unknown> | null): string {
  if (entity_type === 'user' && action === 'block') return 'Usuário bloqueado';
  if (entity_type === 'user' && action === 'unblock') return 'Usuário desbloqueado';
  if (entity_type === 'user' && action === 'create') return 'Novo usuário cadastrado';
  if (entity_type === 'permission' && action === 'update') return 'Permissão de procedimento alterada';
  return `${action} em ${entity_type}`;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [activity, setActivity] = useState<AdminActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchAdminStats(), fetchAdminDashboardInsights(), fetchAdminActivityLog(10)])
      .then(([s, i, a]) => {
        if (!cancelled) {
          setStats(s);
          setInsights(i);
          setActivity(a);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  if (!user || user.email !== ADMIN_EMAIL) return null;

  const metricCards = stats
    ? [
        { title: 'Total de usuários', value: stats.total_usuarios, icon: Users },
        { title: 'Usuários ativos', value: stats.usuarios_ativos, icon: UserCheck },
        { title: 'Usuários bloqueados', value: stats.usuarios_bloqueados, icon: UserX },
        { title: 'Total de procedimentos', value: stats.total_procedimentos, icon: Sliders },
        { title: 'Total de perfis', value: stats.total_perfis, icon: Users },
      ]
    : [];

  const distributionFromStats =
    stats?.total_usuarios != null
      ? [
          { label: 'Admin', value: 1, color: CHART_COLORS[0] },
          { label: 'Profissional', value: Math.max(0, stats.total_usuarios - 1), color: CHART_COLORS[1] },
        ].filter((d) => d.value > 0)
      : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Métricas gerais e insights do sistema</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="gap-2">
            <Link to="/admin/users/new">
              <UserPlus className="h-4 w-4" />
              Adicionar Novo Usuário
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/admin/gestao/procedures-permissions">
              <Sliders className="h-4 w-4" />
              Gestão
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/admin/users">
              <BarChart3 className="h-4 w-4" />
              Ver Usuários
            </Link>
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Carregando...</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {!loading && !error && stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {metricCards.map(({ title, value, icon: Icon }) => (
              <Card key={title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-sm font-medium text-muted-foreground">{title}</span>
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold tabular-nums">{value}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {insights && insights.userGrowth.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Novos usuários por dia (últimos 30 dias)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={insights.userGrowth} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => format(parseISO(v), 'dd/MM', { locale: ptBR })}
                          className="text-xs"
                        />
                        <YAxis className="text-xs" />
                        <Tooltip
                          labelFormatter={(v) => format(parseISO(v), "dd 'de' MMM", { locale: ptBR })}
                          formatter={(value: number) => [value, 'Cadastros']}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Cadastros" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {insights && insights.proceduresCompleted.some((d) => d.count > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Procedimentos iniciados por dia (últimos 30 dias)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={insights.proceduresCompleted} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => format(parseISO(v), 'dd/MM', { locale: ptBR })}
                          className="text-xs"
                        />
                        <YAxis className="text-xs" />
                        <Tooltip
                          labelFormatter={(v) => format(parseISO(v), "dd 'de' MMM", { locale: ptBR })}
                          formatter={(value: number) => [value, 'Procedimentos']}
                        />
                        <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Procedimentos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {distributionFromStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuição de perfis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distributionFromStats}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={({ label, value }) => `${label}: ${value}`}
                        >
                          {distributionFromStats.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, 'Usuários']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className={activity.length > 0 ? '' : 'lg:col-span-2'}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" aria-hidden />
                  Atividade recente
                </CardTitle>
                <p className="text-sm text-muted-foreground">Últimas 10 ações no painel</p>
              </CardHeader>
              <CardContent>
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Nenhuma atividade registrada ainda.</p>
                ) : (
                  <ul className="space-y-2" role="list">
                    {activity.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex flex-col gap-0.5 py-2 border-b border-border/60 last:border-0 text-sm"
                      >
                        <span className="font-medium">
                          {formatActivity(entry.action, entry.entity_type, entry.details)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
