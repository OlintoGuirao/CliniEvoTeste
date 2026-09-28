import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { MENU_PROCEDURES_QUERY_KEY } from '@/components/layout/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sliders, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import type { Database } from '@/integrations/supabase/types';

type ProcedureRow = Database['public']['Tables']['procedures']['Row'];
type UserProcedureRow = Database['public']['Tables']['user_procedures']['Row'];

export function SettingsProcedures() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [procedures, setProcedures] = useState<ProcedureRow[]>([]);
  const [userProcedures, setUserProcedures] = useState<Record<string, UserProcedureRow>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const [procs, upRes] = await Promise.all([
      getProceduresForProfile(profile.id),
      supabase
        .from('user_procedures')
        .select('*')
        .eq('user_id', profile.id),
    ]);
    setProcedures(procs as ProcedureRow[]);
    if (upRes.error) {
      setUserProcedures({});
    } else {
      const map: Record<string, UserProcedureRow> = {};
      (upRes.data ?? []).forEach((row) => {
        map[(row as UserProcedureRow).procedure_id] = row as UserProcedureRow;
      });
      setUserProcedures(map);
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getUserPrefs = (procedureId: string) => {
    const up = userProcedures[procedureId];
    return {
      is_active: up?.is_active ?? true,
      show_in_menu: up?.show_in_menu ?? true,
      show_in_appointments: up?.show_in_appointments ?? true,
    };
  };

  const updateUserProcedure = async (
    procedureId: string,
    patch: { is_active?: boolean; show_in_menu?: boolean; show_in_appointments?: boolean }
  ) => {
    if (!profile?.id) return;
    setUpdating(procedureId);
    const prefs = getUserPrefs(procedureId);
    const next = { ...prefs, ...patch };
    if (patch.is_active === false) {
      next.show_in_menu = false;
      next.show_in_appointments = false;
    }
    const { error } = await supabase.from('user_procedures').upsert(
      {
        user_id: profile.id,
        procedure_id: procedureId,
        ...next,
      },
      { onConflict: 'user_id,procedure_id' }
    );
    setUpdating(null);
    if (error) {
      toast.error('Não foi possível atualizar.');
      return;
    }
    setUserProcedures((prev) => ({
      ...prev,
      [procedureId]: {
        ...(prev[procedureId] ?? {}),
        procedure_id: procedureId,
        user_id: profile.id,
        ...next,
      } as UserProcedureRow,
    }));
    toast.success('Preferência atualizada.');
    queryClient.invalidateQueries({ queryKey: [...MENU_PROCEDURES_QUERY_KEY, profile.id] });
    queryClient.refetchQueries({ queryKey: [...MENU_PROCEDURES_QUERY_KEY, profile.id] });
  };

  const categories = Array.from(new Set(procedures.map((p) => p.category))).sort();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sliders className="w-5 h-5" />
          Procedimentos
        </CardTitle>
        <CardDescription>
          Ative ou desative procedimentos e defina em quais lugares eles aparecem (menu e criação de atendimentos).
          Procedimentos desativados não aparecem em nenhuma parte do sistema para você.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Ajuste rapidamente quais procedimentos ficam ativos e onde aparecem.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : procedures.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">
            Nenhum procedimento disponível. Execute o seed de procedimentos globais no Supabase ou peça ao administrador para adicionar procedimentos.
          </p>
        ) : (
          <ScrollArea className="h-[420px] rounded-md border bg-muted/10 p-4">
            <div className="space-y-5">
              {categories.map((cat) => (
                <div key={cat}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{cat}</p>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-3">
                    {procedures
                      .filter((p) => p.category === cat)
                      .map((p) => {
                        const prefs = getUserPrefs(p.id);
                        const isUpdating = updating === p.id;
                        return (
                          <div
                            key={p.id}
                            className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow"
                          >
                            <div className="flex flex-col gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium break-words line-clamp-2">{p.name}</span>
                                  {p.is_global ? (
                                    <Badge variant="secondary">Global</Badge>
                                  ) : (
                                    <Badge variant="outline">Personalizado</Badge>
                                  )}
                                </div>
                                {p.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 max-w-md">{p.description}</p>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-stretch">
                                <div className="flex h-full min-h-[70px] flex-col justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                                  <Label className="text-[11px] text-muted-foreground leading-tight whitespace-normal">
                                    Ativo
                                  </Label>
                                  <div className="flex items-center justify-start pt-1">
                                    <Switch
                                      checked={prefs.is_active}
                                      disabled={isUpdating}
                                      onCheckedChange={(checked) => updateUserProcedure(p.id, { is_active: checked })}
                                    />
                                  </div>
                                </div>
                                <div className="flex h-full min-h-[70px] flex-col justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                                  <Label className="text-[11px] text-muted-foreground leading-tight whitespace-normal">
                                    No menu
                                  </Label>
                                  <div className="flex items-center justify-start pt-1">
                                    <Switch
                                      checked={prefs.show_in_menu}
                                      disabled={isUpdating || !prefs.is_active}
                                      onCheckedChange={(checked) => updateUserProcedure(p.id, { show_in_menu: checked })}
                                    />
                                  </div>
                                </div>
                                <div className="flex h-full min-h-[70px] flex-col justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                                  <Label className="text-[11px] text-muted-foreground leading-tight whitespace-normal">
                                    Na criação de atendimentos
                                  </Label>
                                  <div className="flex items-center justify-start pt-1">
                                    <Switch
                                      checked={prefs.show_in_appointments}
                                      disabled={isUpdating || !prefs.is_active}
                                      onCheckedChange={(checked) =>
                                        updateUserProcedure(p.id, { show_in_appointments: checked })
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
