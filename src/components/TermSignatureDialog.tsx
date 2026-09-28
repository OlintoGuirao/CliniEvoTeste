import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SignaturePad } from '@/components/SignaturePad';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Term {
  id: string;
  slug: string;
  version: number;
  title: string;
  body: string;
}

interface TermSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientSessionId?: string | null;
  procedureSessionId?: string | null;
  termSlug?: string;
  /** Substitui no corpo do termo: __NOME_PACIENTE__, __CPF__, __DATA__, __PROFISSIONAL__, __COREN__, __IDADE__, __TELEFONE__, __CIDADE__, __ENDERECO__ */
  placeholders?: {
    nomePaciente?: string;
    cpf?: string;
    data?: string;
    profissional?: string;
    coren?: string;
    idade?: string;
    telefone?: string;
    cidade?: string;
    endereco?: string;
  };
  fallbackSignatureData?: string | null;
  onSuccess?: () => void;
}

function replacePlaceholders(
  body: string,
  placeholders?: TermSignatureDialogProps['placeholders']
): string {
  if (!placeholders) return body;
  const data = new Date();
  const dataStr = data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  return body
    .replace(/__NOME_PACIENTE__/g, placeholders.nomePaciente ?? '_________________________')
    .replace(/__CPF__/g, placeholders.cpf ?? '_________________________')
    .replace(/__DATA__/g, placeholders.data ?? dataStr)
    .replace(/__PROFISSIONAL__/g, placeholders.profissional ?? '_________________________')
    .replace(/__COREN__/g, placeholders.coren ?? '_________________________')
    .replace(/__IDADE__/g, placeholders.idade ?? '______')
    .replace(/__TELEFONE__/g, placeholders.telefone ?? '______')
    .replace(/__CIDADE__/g, placeholders.cidade ?? '______')
    .replace(/__ENDERECO__/g, placeholders.endereco ?? '______');
}

export function TermSignatureDialog({
  open,
  onOpenChange,
  patientId,
  patientSessionId,
  procedureSessionId,
  termSlug = 'consentimento',
  placeholders,
  fallbackSignatureData = null,
  onSuccess,
}: TermSignatureDialogProps) {
  const [term, setTerm] = useState<Term | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSignatureData(null);
    (async () => {
      setLoading(true);
      const { data: termData } = await supabase
        .from('terms')
        .select('id, slug, version, title, body')
        .eq('slug', termSlug)
        .eq('active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      const termRow = termData as Term | null;
      setTerm(termRow);

      if (termRow) {
        let q = supabase
          .from('term_signatures')
          .select('signature_data')
          .eq('patient_id', patientId)
          .eq('term_id', termRow.id)
          .order('signed_at', { ascending: false })
          .limit(1);
        if (patientSessionId != null) q = q.eq('patient_session_id', patientSessionId);
        else q = q.is('patient_session_id', null);
        if (procedureSessionId != null) q = q.eq('procedure_session_id', procedureSessionId);
        else q = q.is('procedure_session_id', null);
        const { data: sigRow } = await q.maybeSingle();
        const existingSignature = (sigRow as { signature_data?: string } | null)?.signature_data ?? null;
        if (existingSignature) {
          setSignatureData(existingSignature);
        } else if (typeof fallbackSignatureData === 'string' && fallbackSignatureData.trim()) {
          // Reutiliza assinatura existente (LGPD/anamnese) no termo atual.
          const reused = fallbackSignatureData.trim();
          const { error: reuseError } = await supabase.from('term_signatures').insert({
            patient_id: patientId,
            patient_session_id: patientSessionId || null,
            procedure_session_id: procedureSessionId || null,
            term_id: termRow.id,
            signature_data: reused,
          });
          if (!reuseError) {
            setSignatureData(reused);
            onSuccess?.();
          } else {
            // Em caso de erro de inserção, só exibe a assinatura como fallback visual.
            setSignatureData(reused);
          }
        } else {
          setSignatureData(null);
        }
      }
      setLoading(false);
    })();
  }, [open, termSlug, patientId, patientSessionId, procedureSessionId, fallbackSignatureData, onSuccess]);

  const handleSaveSignature = async (dataUrl: string) => {
    if (!term) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('term_signatures').insert({
        patient_id: patientId,
        patient_session_id: patientSessionId || null,
        procedure_session_id: procedureSessionId || null,
        term_id: term.id,
        signature_data: dataUrl,
      });
      if (error) throw error;
      toast.success('Assinatura registrada.');
      setSignatureData(dataUrl);
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      console.error('Erro ao salvar assinatura:', e);
      const msg = e instanceof Error ? e.message : 'Erro ao salvar assinatura.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogTitle>{term ? term.title : 'Assinatura de termo'}</DialogTitle>
        <DialogDescription>
          {loading ? 'Carregando termo.' : !term ? 'Nenhum termo ativo encontrado.' : 'Leia o termo e assine no campo abaixo.'}
        </DialogDescription>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !term ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhum termo ativo encontrado para &quot;{termSlug}&quot;. Cadastre em Configurações.
          </p>
        ) : (
          <>
            <div className="flex-1 max-h-[420px] overflow-y-auto overflow-x-hidden rounded-md border p-4 text-sm text-foreground/90">
              <p className="mt-2 whitespace-pre-wrap break-words">{replacePlaceholders(term.body, placeholders)}</p>
            </div>
            <div className="pt-4 border-t border-border">
              {signatureData ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Assinatura já registrada</p>
                  <img
                    src={signatureData}
                    alt="Assinatura"
                    className="max-h-[180px] w-auto border rounded-lg bg-muted/30"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSignatureData(null)}
                  >
                    Assinar novamente
                  </Button>
                </div>
              ) : (
                <SignaturePad
                  onSave={handleSaveSignature}
                  height={180}
                  className="pt-4"
                />
              )}
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
