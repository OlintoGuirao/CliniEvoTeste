import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type ProcedureSqlPanelProps = {
  sql: string;
  onClear?: () => void;
  filename?: string;
};

export function ProcedureSqlPanel({ sql, onClear, filename = 'procedure-migration.sql' }: ProcedureSqlPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!sql.trim()) return;
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      toast.success('SQL copiado para a área de transferência.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar o SQL.');
    }
  };

  const handleDownload = () => {
    if (!sql.trim()) return;
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo SQL baixado.');
  };

  if (!sql.trim()) return null;

  return (
    <Card className="border-dashed border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Script SQL para o banco</CardTitle>
        <p className="text-sm text-muted-foreground">
          Salve em <code className="text-xs">supabase/migrations/</code> e execute no Supabase. Cada ação abaixo
          gera SQL específico para o profissional selecionado.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          readOnly
          value={sql}
          className="font-mono text-xs min-h-[200px] resize-y"
          aria-label="Script SQL gerado"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
            <Copy className="h-4 w-4 mr-1.5" />
            {copied ? 'Copiado!' : 'Copiar SQL'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1.5" />
            Baixar .sql
          </Button>
          {onClear ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Limpar
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
