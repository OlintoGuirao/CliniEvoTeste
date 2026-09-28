import { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/** Limite do bucket app-logos (1 MB). */
const MAX_LOGO_BYTES = 1048576;

type BranchLogoFieldProps = {
  branchId: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export function BranchLogoField({ branchId, value, onChange, disabled }: BranchLogoFieldProps) {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    if (!/^(jpe?g|png|gif|webp)$/.test(ext)) {
      toast.error('Use JPEG, PNG, GIF ou WebP.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('A imagem precisa ter no máximo 1 MB.');
      return;
    }

    setUploading(true);
    // Bucket app-logos: upload só na pasta do usuário autenticado (auth.uid)
    const path = `${profile.id}/branches/${branchId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from('app-logos').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (uploadError) {
      setUploading(false);
      toast.error(`Não foi possível enviar o logo. ${uploadError.message}`);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('app-logos').getPublicUrl(path);
    onChange(`${publicUrl}?v=${Date.now()}`);
    setUploading(false);
    toast.success('Logo enviado. Clique em Salvar para confirmar.');
    e.target.value = '';
  };

  return (
    <div className="flex gap-3 rounded-xl border bg-muted/20 p-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          <span className="text-[10px] text-muted-foreground text-center px-1 leading-tight">Sem logo</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Input
          id={`branch-logo-url-${branchId}`}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="URL do logo (opcional)"
          className="h-9 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={`branch-logo-file-${branchId}`}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="sr-only"
            disabled={disabled || uploading || !profile?.id}
            onChange={handleFile}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={disabled || uploading || !profile?.id}
            onClick={() => document.getElementById(`branch-logo-file-${branchId}`)?.click()}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Enviar imagem
          </Button>
          <span className="text-[11px] text-muted-foreground">Máx. 1 MB</span>
        </div>
      </div>
    </div>
  );
}
