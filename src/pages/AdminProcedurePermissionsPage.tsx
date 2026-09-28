import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProcedurePermissions } from '@/hooks/useProcedurePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_EMAIL = 'admin@clinievo.com.br';

export default function AdminProcedurePermissionsPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.email === 'admin@clinievo.com.br';
  const [professionalId, setProfessionalId] = useState('');
  const [searchProcedure, setSearchProcedure] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const {
    data,
    loading,
    error,
    savingId,
    isVisible,
    updatePermission,
    refetch,
  } = useProcedurePermissions(!!isAdmin, {
    adminEmail: user?.email,
    onSaved: () => toast.success('Permissões salvas!'),
  });

  const categories = useMemo(() => {
    if (!data?.procedures) return [];
    const set = new Set(data.procedures.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [data?.procedures]);

  const filteredProcedures = useMemo(() => {
    if (!data?.procedures) return [];
    let list = data.procedures;
    if (searchProcedure.trim()) {
      const q = searchProcedure.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.slug || '').toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') {
      list = list.filter((p) => p.category === categoryFilter);
    }
    return list;
  }, [data?.procedures, searchProcedure, categoryFilter]);

  const currentProfileName = useMemo(() => {
    const p = data?.profiles.find((x) => x.id === professionalId);
    return p ? (p.full_name || p.email) : '';
  }, [data?.profiles, professionalId]);

  const enabledCount = useMemo(() => {
    if (!professionalId) return 0;
    return filteredProcedures.filter((proc) => isVisible(professionalId, proc.id)).length;
  }, [filteredProcedures, professionalId, isVisible]);

  useEffect(() => {
    if (user === null) return;
    if (!user.email || user.email !== ADMIN_EMAIL) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  if (user && user.email !== ADMIN_EMAIL) {
    return null;
  }

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Permissões de Procedimentos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Escolha o profissional e defina quais procedimentos ele pode ver no menu.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Seleção</CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecione o profissional para configurar os procedimentos permitidos.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-md">
            <p className="text-xs font-medium text-muted-foreground">Profissional</p>
            <Select
              value={professionalId || undefined}
              onValueChange={setProfessionalId}
              disabled={loading || !data?.profiles.length}
            >
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {data?.profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {professionalId ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Procedimentos permitidos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Controle de exibição para{' '}
              <span className="font-medium text-foreground">{currentProfileName}</span>.
              {filteredProcedures.length > 0 ? (
                <>
                  {' '}
                  <span className="text-foreground/80">
                    ({enabledCount} de {filteredProcedures.length} ativos)
                  </span>
                </>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <div className="relative w-full sm:w-64">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  placeholder="Pesquisar procedimento..."
                  value={searchProcedure}
                  onChange={(e) => setSearchProcedure(e.target.value)}
                  className="pl-9 rounded-xl h-10"
                  aria-label="Pesquisar procedimentos"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px] rounded-xl h-10" aria-label="Filtrar por categoria">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Carregando...</span>
              </div>
            ) : error ? (
              <div className="py-6 text-center">
                <p className="text-destructive mb-2">{error}</p>
                <Button variant="outline" onClick={refetch}>
                  Tentar novamente
                </Button>
              </div>
            ) : filteredProcedures.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">
                Nenhum procedimento corresponde aos filtros.
              </p>
            ) : (
              <div className="rounded-xl border bg-card divide-y">
                {filteredProcedures.map((proc) => {
                  const saving = savingId === `${professionalId}:${proc.id}`;
                  const visible = isVisible(professionalId, proc.id);
                  return (
                    <div
                      key={proc.id}
                      className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" title={proc.name}>
                          {proc.name}
                        </p>
                        {proc.category ? (
                          <p className="text-xs text-muted-foreground truncate">{proc.category}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                        <Switch
                          checked={visible}
                          disabled={saving}
                          onCheckedChange={(checked) =>
                            updatePermission(professionalId, proc.id, checked === true)
                          }
                          aria-label={`Permitir ${proc.name}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
