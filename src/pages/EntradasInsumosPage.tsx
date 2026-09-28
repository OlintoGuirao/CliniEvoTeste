import { useCallback, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { resolveBranchIdForInsert } from '@/lib/resolveBranchIdForInsert';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Package, Plus, Pencil, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { FiltroPeriodo, type FiltroPeriodoValue } from '@/components/faturamento/FiltroPeriodo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useInsumosEntradas, useInsumoEntradaMutations, type InsumoEntradaRow } from '@/hooks/use-insumos-entradas';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function getDefaultPeriod(): FiltroPeriodoValue {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { preset: 'mes', dataInicio: start, dataFim: end };
}

function parseMoneyInput(s: string): number {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return NaN;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function parseQuantidade(s: string): number {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return NaN;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export default function EntradasInsumosPage() {
  const { profile } = useAuth();
  const [periodo, setPeriodo] = useState<FiltroPeriodoValue>(getDefaultPeriod);
  const filtros = useMemo(
    () => ({ dataInicio: periodo.dataInicio, dataFim: periodo.dataFim }),
    [periodo.dataInicio, periodo.dataFim]
  );
  const { list, resumo, isLoading } = useInsumosEntradas(filtros);
  const { insert, update, remove, professionalId } = useInsumoEntradaMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InsumoEntradaRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InsumoEntradaRow | null>(null);

  const [nomeProduto, setNomeProduto] = useState('');
  const [quantidadeStr, setQuantidadeStr] = useState('');
  const [valorStr, setValorStr] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataCompra, setDataCompra] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setNomeProduto('');
    setQuantidadeStr('');
    setValorStr('');
    setDescricao('');
    setDataCompra(new Date().toISOString().slice(0, 10));
    setFile(null);
    setEditing(null);
  }, []);

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (row: InsumoEntradaRow) => {
    setEditing(row);
    setNomeProduto(row.nome_produto);
    setQuantidadeStr(String(row.quantidade).replace('.', ','));
    setValorStr(
      Number(row.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
    setDescricao(row.descricao ?? '');
    setDataCompra(row.data_compra);
    setFile(null);
    setDialogOpen(true);
  };

  const uploadFoto = async (f: File): Promise<{ url: string; path: string }> => {
    if (!professionalId) throw new Error('Sessão inválida');
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const path = `${professionalId}/${crypto.randomUUID()}.${safeExt}`;
    const { error } = await supabase.storage.from('insumos-nf').upload(path, f, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('insumos-nf').getPublicUrl(path);
    return { url: data.publicUrl, path };
  };

  const handleSave = async () => {
    const nome = nomeProduto.trim();
    if (!nome) {
      toast.error('Informe o nome do produto.');
      return;
    }
    const q = parseQuantidade(quantidadeStr);
    if (!Number.isFinite(q) || q <= 0) {
      toast.error('Quantidade inválida (use número maior que zero).');
      return;
    }
    const valor = parseMoneyInput(valorStr);
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error('Valor inválido.');
      return;
    }
    if (!professionalId) return;

    setSaving(true);
    try {
      let fotoUrl: string | null = editing?.foto_url ?? null;
      let fotoPath: string | null = editing?.foto_path ?? null;

      if (file) {
        const up = await uploadFoto(file);
        if (editing?.foto_path && editing.foto_path !== up.path) {
          await supabase.storage.from('insumos-nf').remove([editing.foto_path]);
        }
        fotoUrl = up.url;
        fotoPath = up.path;
      }

      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          patch: {
            nome_produto: nome,
            quantidade: q,
            valor_total: valor,
            descricao: descricao.trim() || null,
            foto_url: fotoUrl,
            foto_path: fotoPath,
            data_compra: dataCompra,
          },
        });
        toast.success('Entrada atualizada.');
      } else {
        const branchId = await resolveBranchIdForInsert(profile);
        await insert.mutateAsync({
          professional_id: professionalId,
          nome_produto: nome,
          quantidade: q,
          valor_total: valor,
          descricao: descricao.trim() || null,
          foto_url: fotoUrl,
          foto_path: fotoPath,
          data_compra: dataCompra,
          ...(branchId ? { branch_id: branchId } : {}),
        });
        toast.success('Entrada registrada.');
      }
      setDialogOpen(false);
      resetForm();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Não foi possível salvar.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync({ id: deleteTarget.id, fotoPath: deleteTarget.foto_path });
      toast.success('Entrada excluída.');
      setDeleteTarget(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Não foi possível excluir.';
      toast.error(msg);
    }
  };

  const disabledModules = (profile as { disabled_modules?: string[] | null } | null)?.disabled_modules;
  if (Array.isArray(disabledModules) && disabledModules.includes('insumos-nf')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={cn('space-y-4 md:space-y-6 animate-fade-in')}>
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Entradas NF (Insumos)' },
        ]}
        className="mb-1 hidden md:block"
      />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-base md:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 md:w-7 md:h-7 text-primary" />
            Entradas NF (Insumos)
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            Controle simples de compras: estoque por lançamento e balancete de gastos no período.
          </p>
        </div>
        <Button type="button" className="gap-2 shrink-0 w-full sm:w-auto" onClick={openNew}>
          <Plus className="w-4 h-4" />
          Nova entrada
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-6">
          <CardTitle className="text-sm md:text-base">Filtro de período</CardTitle>
          <CardDescription className="text-xs">
            Ano atual, mês atual, atalhos ou intervalo personalizado. O balancete considera apenas entradas com data
            de compra no período.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <FiltroPeriodo value={periodo} onChange={setPeriodo} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="p-3 md:p-4 pb-1">
            <CardDescription>Total gasto no período</CardDescription>
            <CardTitle className="text-lg md:text-xl tabular-nums">{BRL.format(resumo.totalGasto)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 md:p-4 pb-1">
            <CardDescription>Soma das quantidades</CardDescription>
            <CardTitle className="text-lg md:text-xl tabular-nums">
              {resumo.totalQuantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 md:p-4 pb-1">
            <CardDescription>Lançamentos</CardDescription>
            <CardTitle className="text-lg md:text-xl tabular-nums">{resumo.numLancamentos}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-sm md:text-base">Registros</CardTitle>
          <CardDescription>Lista filtrada por data de compra.</CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma entrada no período.</p>
          ) : (
            <ul className="space-y-3">
              {list.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col sm:flex-row"
                >
                  {row.foto_url ? (
                    <div className="sm:w-36 h-36 sm:h-auto shrink-0 bg-muted">
                      <img
                        src={row.foto_url}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ) : (
                    <div className="sm:w-36 h-24 sm:h-auto shrink-0 bg-muted/50 flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="w-10 h-10 opacity-40" />
                    </div>
                  )}
                  <div className="p-4 flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{row.nome_produto}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(row.data_compra + 'T12:00:00').toLocaleDateString('pt-BR')} · Qtd.{' '}
                          {Number(row.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ·{' '}
                          {BRL.format(Number(row.valor_total))}
                        </p>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(row)} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(row)}
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {row.descricao?.trim() ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{row.descricao}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar entrada' : 'Nova entrada'}</DialogTitle>
            <DialogDescription>
              Nome, quantidade, valor total da compra, descrição opcional e foto opcional (NF ou produto).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ins-nome">Nome do produto</Label>
              <Input id="ins-nome" value={nomeProduto} onChange={(e) => setNomeProduto(e.target.value)} placeholder="Ex.: Lidocaína 2%" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ins-qtd">Quantidade</Label>
                <Input
                  id="ins-qtd"
                  inputMode="decimal"
                  value={quantidadeStr}
                  onChange={(e) => setQuantidadeStr(e.target.value)}
                  placeholder="10 ou 2,5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ins-valor">Valor (R$)</Label>
                <Input
                  id="ins-valor"
                  inputMode="decimal"
                  value={valorStr}
                  onChange={(e) => setValorStr(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ins-data">Data da compra</Label>
              <Input id="ins-data" type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ins-desc">Descrição</Label>
              <Textarea
                id="ins-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Fornecedor, nota, lote…"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ins-foto">Foto</Label>
              <Input
                id="ins-foto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {editing?.foto_url && !file ? (
                <p className="text-xs text-muted-foreground">Foto atual mantida. Envie outro arquivo para substituir.</p>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving || !profile?.id}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir entrada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A foto no armazenamento também será removida, se existir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
