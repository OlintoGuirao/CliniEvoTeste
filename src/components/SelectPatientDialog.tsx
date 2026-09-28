import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { supabase } from '@/integrations/supabase/client';
import { formatPatientDisplayName, patientMatchesSearch } from '@/lib/patientDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Patient {
  id: string;
  full_name: string;
  nickname?: string | null;
}

interface SelectPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (patientId: string) => void;
  title?: string;
  description?: string;
}

export function SelectPatientDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Adicionar paciente existente',
  description = 'Selecione um paciente já cadastrado para reutilizar os dados e iniciar o tratamento.',
}: SelectPatientDialogProps) {
  const { user, profile } = useAuth();
  const copy = useUiCopy();
  const professionalId = profile?.id ?? user?.id;
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || !professionalId) return;
    setLoading(true);
    supabase
      .from('patients')
      .select('id, full_name, nickname')
      .eq('professional_id', professionalId)
      .eq('is_active', true)
      .order('full_name')
      .then(({ data, error }) => {
        if (error) {
          toast.error('Erro ao carregar pacientes.');
          return;
        }
        setPatients((data ?? []) as Patient[]);
      })
      .finally(() => setLoading(false));
  }, [open, professionalId]);

  const filtered = search.trim()
    ? patients.filter((p) =>
        copy.isSalon
          ? patientMatchesSearch(p, search.trim())
          : p.full_name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : patients;

  const handleSelect = (patientId: string) => {
    onSelect(patientId);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-auto border rounded-lg mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">
                {search.trim()
                  ? 'Nenhum paciente encontrado.'
                  : 'Nenhum paciente cadastrado.'}
              </p>
            </div>
          ) : (
            <ul className="p-1">
              {filtered.map((p) => (
                <li key={p.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start font-normal h-auto py-3 px-3"
                    onClick={() => handleSelect(p.id)}
                  >
                    {copy.isSalon ? formatPatientDisplayName(p.full_name, p.nickname) : p.full_name}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
