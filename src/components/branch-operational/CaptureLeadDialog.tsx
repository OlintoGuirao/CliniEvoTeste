import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useBranchOperationalMutations } from '@/hooks/use-branch-operational';
import { findExistingPatientByPhone } from '@/lib/phone';
import {
  JOURNEY_CAPTURE_CHANNEL_LABELS,
  requiresCaptureChannel,
} from '@/lib/branchOperationalJourney';
import { findJourneysByPatientInBranch } from '@/services/api/branchOperationalApi';
import type { JourneyCaptureChannel } from '@/types/branchOperationalJourney';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  profileId: string;
};

export function CaptureLeadDialog({ open, onOpenChange, branchId, profileId }: Props) {
  const navigate = useNavigate();
  const { createJourney } = useBranchOperationalMutations();
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [captureChannel, setCaptureChannel] = useState<JourneyCaptureChannel | ''>('');
  const [captureDetail, setCaptureDetail] = useState('');
  const [notes, setNotes] = useState('');
  const [duplicatePatientId, setDuplicatePatientId] = useState<string | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);

  const reset = () => {
    setLeadName('');
    setLeadPhone('');
    setLeadEmail('');
    setCaptureChannel('');
    setCaptureDetail('');
    setNotes('');
    setDuplicatePatientId(null);
  };

  const checkDuplicate = async () => {
    if (!leadPhone.trim()) return;
    setCheckingPhone(true);
    try {
      const existing = await findExistingPatientByPhone({
        professionalId: profileId,
        phone: leadPhone,
      });
      setDuplicatePatientId(existing?.id ?? null);
    } finally {
      setCheckingPhone(false);
    }
  };

  const handleSubmit = async () => {
    if (!leadName.trim()) {
      toast.error('Informe o nome do contato.');
      return;
    }
    if (requiresCaptureChannel(null) && !captureChannel) {
      toast.error('Canal de captação é obrigatório.');
      return;
    }

    try {
      if (duplicatePatientId) {
        const existingJourneys = await findJourneysByPatientInBranch(branchId, duplicatePatientId);
        if (existingJourneys.length) {
          toast.message('Paciente já possui jornada ativa nesta unidade.');
          onOpenChange(false);
          navigate(`/operacional/${existingJourneys[0].id}`);
          return;
        }
        const journey = await createJourney.mutateAsync({
          patientId: duplicatePatientId,
          captureChannel: captureChannel || undefined,
          captureDetail,
          leadName,
          leadPhone,
          leadEmail,
          notes,
        });
        toast.success('Contato vinculado ao paciente existente.');
        onOpenChange(false);
        reset();
        navigate(`/operacional/${journey.id}`);
        return;
      }

      const journey = await createJourney.mutateAsync({
        captureChannel: captureChannel as JourneyCaptureChannel,
        captureDetail,
        leadName,
        leadPhone,
        leadEmail,
        notes,
      });
      toast.success('Novo contato registrado.');
      onOpenChange(false);
      reset();
      navigate(`/operacional/${journey.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o contato.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo contato — captação</DialogTitle>
          <DialogDescription>
            Registre a origem do lead na sua unidade. Se o telefone já existir, você poderá vincular ao cadastro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lead-name">Nome *</Label>
            <Input id="lead-name" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-phone">Telefone / WhatsApp</Label>
            <Input
              id="lead-phone"
              value={leadPhone}
              onChange={(e) => {
                setLeadPhone(e.target.value);
                setDuplicatePatientId(null);
              }}
              onBlur={() => void checkDuplicate()}
            />
            {checkingPhone ? (
              <p className="text-xs text-muted-foreground">Verificando duplicidade…</p>
            ) : duplicatePatientId ? (
              <p className="text-xs text-amber-600">
                Paciente existente encontrado — ao salvar, a jornada será vinculada ao cadastro.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-email">E-mail</Label>
            <Input id="lead-email" type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Canal de captação *</Label>
            <Select value={captureChannel} onValueChange={(v) => setCaptureChannel(v as JourneyCaptureChannel)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o canal" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(JOURNEY_CAPTURE_CHANNEL_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="capture-detail">Campanha / origem detalhada</Label>
            <Input id="capture-detail" value={captureDetail} onChange={(e) => setCaptureDetail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={createJourney.isPending}>
            {createJourney.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Registrar contato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
