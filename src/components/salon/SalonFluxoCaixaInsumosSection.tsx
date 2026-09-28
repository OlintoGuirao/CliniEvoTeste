import { useCallback, useState } from 'react';
import { ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
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
import {
  useInsumoEntradaMutations,
  type InsumoEntradaRow,
} from '@/hooks/use-insumos-entradas';
import { resolveBranchIdForInsert } from '@/lib/resolveBranchIdForInsert';
import { formatFluxoCurrency } from '@/lib/fluxoCaixa';
import { supabase } from '@/integrations/supabase/client';

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

type Props = {
  list: InsumoEntradaRow[];
  total: number;
  isLoading?: boolean;
};

export function SalonFluxoCaixaInsumosSection({ list, total, isLoading }: Props) {
  const { profile } = useAuth();
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
    setValorStr(String(row.valor_total).replace('.', ','));
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
      toast.error('Quantidade inválida.');
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
        toast.success('Insumo atualizado.');
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
        toast.success('Insumo registrado.');
      }
      setDialogOpen(false);
      resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync({ id: deleteTarget.id, fotoPath: deleteTarget.foto_path });
      toast.success('Insumo excluído.');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Entradas de insumos</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compras de produtos e materiais no período.
          </p>
          <p className="text-sm font-medium tabular-nums mt-1">
            Total no período: {formatFluxoCurrency(total)}
          </p>
        </div>
        <Button type="button" size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhum insumo neste período.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-2 rounded-xl border bg-background px-3 py-2.5"
            >
              <div className="flex min-w-0 gap-2">
                {row.foto_url ? (
                  <img
                    src={row.foto_url}
                    alt=""
                    className="h-10 w-10 rounded-md object-cover shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted shrink-0">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{row.nome_produto}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.data_compra.slice(0, 10).split('-').reverse().join('/')} · qtd{' '}
                    {Number(row.quantidade).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-sm font-semibold tabular-nums mr-1">
                  {formatFluxoCurrency(Number(row.valor_total))}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(row)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(row)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar insumo' : 'Nova entrada de insumo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="salon-insumo-nome">Produto</Label>
              <Input
                id="salon-insumo-nome"
                value={nomeProduto}
                onChange={(e) => setNomeProduto(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="salon-insumo-qtd">Quantidade</Label>
                <Input
                  id="salon-insumo-qtd"
                  value={quantidadeStr}
                  onChange={(e) => setQuantidadeStr(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="salon-insumo-valor">Valor total (R$)</Label>
                <Input
                  id="salon-insumo-valor"
                  value={valorStr}
                  onChange={(e) => setValorStr(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salon-insumo-data">Data da compra</Label>
              <Input
                id="salon-insumo-data"
                type="date"
                value={dataCompra}
                onChange={(e) => setDataCompra(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salon-insumo-desc">Descrição (opcional)</Label>
              <Textarea
                id="salon-insumo-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salon-insumo-foto">Foto (opcional)</Label>
              <Input
                id="salon-insumo-foto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir insumo?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `Remover “${deleteTarget.nome_produto}”.` : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
