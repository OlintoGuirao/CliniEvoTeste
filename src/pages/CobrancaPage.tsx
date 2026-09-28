import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, Pencil, QrCode, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { fetchPatients, PATIENTS_QUERY_KEY } from '@/api/patients';
import { isCobrancaModuleEnabled } from '@/lib/professionalModules';
import {
  buildCobrancaPixMessage,
  buildCobrancaPixWaMeUrl,
  generatePixQrDataUrl,
  getPixKeyTypeLabel,
  maskPixKey,
  normalizePixKeyForStorage,
  parsePixAmountBrl,
  sanitizePixReceiverName,
  sendCobrancaPixViaEvolution,
  validatePixKey,
  type PixKeyType,
} from '@/lib/cobrancaPix';
import { fetchPixSettings, removePixSettings, savePixSettings } from '@/lib/pixSettings';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import { cn } from '@/lib/utils';

const PIX_KEY_TYPES: PixKeyType[] = ['cpf', 'cnpj', 'email', 'phone', 'random'];

export default function CobrancaPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const professionalId = profile?.id ?? '';

  const [editingPix, setEditingPix] = useState(false);
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('email');
  const [pixKeyInput, setPixKeyInput] = useState('');
  const [receiverNameInput, setReceiverNameInput] = useState('');
  const [previewQrUrl, setPreviewQrUrl] = useState<string | null>(null);
  const [savingPix, setSavingPix] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removingPix, setRemovingPix] = useState(false);

  const [patientOpen, setPatientOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [sendingCharge, setSendingCharge] = useState(false);

  const { data: pixSettings, isLoading: pixLoading } = useQuery({
    queryKey: ['pix-settings', professionalId],
    queryFn: () => fetchPixSettings(professionalId),
    enabled: !!professionalId,
  });

  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: [PATIENTS_QUERY_KEY, professionalId],
    queryFn: () => fetchPatients(professionalId),
    enabled: !!professionalId,
  });

  const hasPixKey = Boolean(pixSettings?.pix_key?.trim());
  const showPixForm = !hasPixKey || editingPix;

  const defaultReceiverName = useMemo(() => {
    const appName = String((profile as { app_name?: string | null } | null)?.app_name || '').trim();
    return sanitizePixReceiverName(appName || profile?.full_name || 'RECEBEDOR');
  }, [profile]);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) ?? null,
    [patients, selectedPatientId]
  );

  const professionalDisplayName = useMemo(() => {
    const appName = String((profile as { app_name?: string | null } | null)?.app_name || '').trim();
    return appName || profile?.full_name || 'Profissional';
  }, [profile]);

  const resetPixForm = useCallback(() => {
    setPixKeyType((pixSettings?.pix_key_type as PixKeyType) || 'email');
    setPixKeyInput(pixSettings?.pix_key || '');
    setReceiverNameInput(pixSettings?.pix_receiver_name || defaultReceiverName);
  }, [defaultReceiverName, pixSettings]);

  useEffect(() => {
    if (!showPixForm) return;
    resetPixForm();
  }, [showPixForm, resetPixForm]);

  useEffect(() => {
    if (!showPixForm || !pixKeyInput.trim()) {
      setPreviewQrUrl(null);
      return;
    }

    const validationError = validatePixKey(pixKeyType, pixKeyInput);
    if (validationError) {
      setPreviewQrUrl(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const result = await generatePixQrDataUrl({
          pixKey: normalizePixKeyForStorage(pixKeyType, pixKeyInput),
          receiverName: sanitizePixReceiverName(receiverNameInput || defaultReceiverName),
        });
        if (!cancelled) setPreviewQrUrl(result?.dataUrl ?? null);
      })();
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [showPixForm, pixKeyType, pixKeyInput, receiverNameInput, defaultReceiverName]);

  useEffect(() => {
    if (!hasPixKey || editingPix || !pixSettings?.pix_key) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const result = await generatePixQrDataUrl({
        pixKey: pixSettings.pix_key!,
        receiverName: pixSettings.pix_receiver_name || defaultReceiverName,
      });
      if (!cancelled) setPreviewQrUrl(result?.dataUrl ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPixKey, editingPix, pixSettings, defaultReceiverName]);

  const handleSavePix = async () => {
    const validationError = validatePixKey(pixKeyType, pixKeyInput);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const receiverName = sanitizePixReceiverName(receiverNameInput || defaultReceiverName);
    if (!receiverName) {
      toast.error('Informe o nome do recebedor.');
      return;
    }

    setSavingPix(true);
    try {
      await savePixSettings({
        professionalId,
        pixKey: normalizePixKeyForStorage(pixKeyType, pixKeyInput),
        pixKeyType,
        receiverName,
      });
      await queryClient.invalidateQueries({ queryKey: ['pix-settings', professionalId] });
      setEditingPix(false);
      toast.success('Chave PIX salva.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a chave PIX.');
    } finally {
      setSavingPix(false);
    }
  };

  const handleRemovePix = async () => {
    setRemovingPix(true);
    try {
      await removePixSettings(professionalId);
      await queryClient.invalidateQueries({ queryKey: ['pix-settings', professionalId] });
      setEditingPix(false);
      setPreviewQrUrl(null);
      setRemoveDialogOpen(false);
      toast.success('Chave PIX removida.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover a chave PIX.');
    } finally {
      setRemovingPix(false);
    }
  };

  const handleSendCharge = async () => {
    if (!hasPixKey) {
      toast.error('Cadastre sua chave PIX antes de enviar cobranças.');
      return;
    }
    if (!selectedPatientId) {
      toast.error('Selecione o paciente.');
      return;
    }

    const amount = parsePixAmountBrl(amountInput);
    if (!amount) {
      toast.error('Informe um valor válido.');
      return;
    }

    if (!selectedPatient?.phone) {
      toast.error('Cadastre o telefone do paciente para enviar a cobrança.');
      return;
    }

    setSendingCharge(true);
    try {
      const templates = await loadWhatsappManualTemplates(professionalId);
      const entry = templates.cobranca_pix;
      if (!entry.enabled) {
        toast.message('Mensagem desativada em Mensagens padrão.');
        return;
      }

      const message = buildCobrancaPixMessage({
        patientName: selectedPatient.full_name,
        professionalName: professionalDisplayName,
        amount,
        description: descriptionInput.trim() || null,
        template: entry.message,
      });

      const evolution = await sendCobrancaPixViaEvolution({
        professionalId,
        patientId: selectedPatientId,
        amount,
        description: descriptionInput.trim() || null,
        message,
      });

      if (evolution.ok) {
        toast.success(`Cobrança enviada para ${selectedPatient.full_name}.`);
        setAmountInput('');
        setDescriptionInput('');
        return;
      }

      const qr = await generatePixQrDataUrl({
        pixKey: pixSettings!.pix_key!,
        receiverName: pixSettings!.pix_receiver_name || defaultReceiverName,
        amount,
        description: descriptionInput.trim() || null,
      });

      const waUrl = buildCobrancaPixWaMeUrl({
        phone: selectedPatient.phone,
        patientName: selectedPatient.full_name,
        professionalName: professionalDisplayName,
        amount,
        description: descriptionInput.trim() || null,
        brCode: qr?.brCode,
        template: entry.message,
      });

      if (waUrl) {
        window.open(waUrl, '_blank');
        toast.message('WhatsApp não conectado', {
          description: 'Abrimos o WhatsApp com a mensagem. O QR Code precisa ser enviado manualmente se necessário.',
        });
      } else {
        toast.error(evolution.error || 'Não foi possível enviar a cobrança.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a cobrança.');
    } finally {
      setSendingCharge(false);
    }
  };

  if (!isCobrancaModuleEnabled(profile)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-w-0 space-y-4 md:space-y-6 animate-fade-in">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Cobrança' },
        ]}
        className="mb-1 hidden md:block"
      />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cobrança</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre sua chave PIX e envie cobranças com QR Code pelo WhatsApp.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode className="h-5 w-5 text-primary" />
            Chave PIX
          </CardTitle>
          <CardDescription>
            {hasPixKey && !editingPix
              ? 'Sua chave está cadastrada. Use Editar ou Remover para alterar.'
              : 'Informe a chave para gerar o QR Code das cobranças.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pixLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : showPixForm ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de chave</Label>
                  <Select value={pixKeyType} onValueChange={(v) => setPixKeyType(v as PixKeyType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIX_KEY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {getPixKeyTypeLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chave PIX</Label>
                  <Input
                    value={pixKeyInput}
                    onChange={(e) => setPixKeyInput(e.target.value)}
                    placeholder={getPixKeyTypeLabel(pixKeyType)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nome do recebedor (no QR Code)</Label>
                  <Input
                    value={receiverNameInput}
                    onChange={(e) => setReceiverNameInput(e.target.value)}
                    placeholder={defaultReceiverName}
                    maxLength={25}
                  />
                </div>
              </div>

              {previewQrUrl ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border bg-muted/30 p-4">
                  <img src={previewQrUrl} alt="QR Code PIX" className="h-48 w-48 rounded-lg bg-white p-2" />
                  <p className="text-xs text-muted-foreground">Pré-visualização do QR Code PIX</p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleSavePix()} disabled={savingPix}>
                  {savingPix ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar chave PIX
                </Button>
                {hasPixKey ? (
                  <Button type="button" variant="outline" onClick={() => setEditingPix(false)}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                <p className="text-sm font-medium">{getPixKeyTypeLabel(pixSettings?.pix_key_type)}</p>
                <p className="text-sm text-muted-foreground break-all">
                  {maskPixKey(pixSettings?.pix_key_type, pixSettings?.pix_key)}
                </p>
                {pixSettings?.pix_receiver_name ? (
                  <p className="text-xs text-muted-foreground">
                    Recebedor: {pixSettings.pix_receiver_name}
                  </p>
                ) : null}
              </div>

              {previewQrUrl ? (
                <div className="flex justify-center">
                  <img src={previewQrUrl} alt="QR Code PIX" className="h-40 w-40 rounded-lg border bg-white p-2" />
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingPix(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button type="button" variant="outline" className="text-destructive" onClick={() => setRemoveDialogOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-5 w-5 text-primary" />
            Enviar cobrança
          </CardTitle>
          <CardDescription>
            Selecione o paciente e o valor. A cobrança com QR Code PIX será enviada pelo WhatsApp conectado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Paciente</Label>
              <Popover open={patientOpen} onOpenChange={setPatientOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={patientOpen}
                    className="w-full justify-between"
                    disabled={patientsLoading}
                  >
                    {selectedPatient ? selectedPatient.full_name : 'Selecione o paciente'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Filtrar paciente..." />
                    <CommandEmpty>
                      {patients.length === 0
                        ? 'Nenhum paciente cadastrado.'
                        : 'Nenhum paciente encontrado.'}
                    </CommandEmpty>
                    <CommandGroup>
                      {patients.map((patient) => (
                        <CommandItem
                          key={patient.id}
                          value={patient.full_name}
                          onSelect={() => {
                            setSelectedPatientId(patient.id);
                            setPatientOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedPatientId === patient.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          {patient.full_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="Ex.: Consulta, procedimento, mensalidade..."
                maxLength={80}
              />
            </div>
          </div>

          <Button
            onClick={() => void handleSendCharge()}
            disabled={sendingCharge || !hasPixKey}
            className="w-full sm:w-auto"
          >
            {sendingCharge ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar cobrança
          </Button>

          {!hasPixKey ? (
            <p className="text-xs text-muted-foreground">
              Cadastre a chave PIX acima para habilitar o envio.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover chave PIX?</AlertDialogTitle>
            <AlertDialogDescription>
              Você precisará cadastrar novamente para enviar cobranças com QR Code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingPix}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRemovePix();
              }}
              disabled={removingPix}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingPix ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
