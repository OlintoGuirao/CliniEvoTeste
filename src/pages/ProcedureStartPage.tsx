import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { PageLoading } from '@/components/layout/PageLoading';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import { ArrowLeft, Loader2, Scale, Calendar, Check, ChevronsUpDown } from 'lucide-react';
import { PhotoUploadField } from '@/components/PhotoUploadField';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type ProcedureRow = Database['public']['Tables']['procedures']['Row'];
type ProcedureFieldRow = Database['public']['Tables']['procedure_fields']['Row'];

interface PatientOption {
  id: string;
  full_name: string;
}

function parseOptions(opts: unknown): string[] {
  if (Array.isArray(opts)) return opts as string[];
  if (typeof opts === 'string') {
    try {
      const parsed = JSON.parse(opts);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** IMC = peso (kg) / (altura em m)². Altura em cm; se entre 0.5 e 3, trata como metros. */
function calcImc(pesoKg: number | null | undefined, alturaCm: number | null | undefined): number | null {
  if (pesoKg == null || alturaCm == null || pesoKg <= 0 || alturaCm <= 0) return null;
  let altCm = alturaCm;
  if (alturaCm >= 0.5 && alturaCm <= 3) altCm = alturaCm * 100;
  const alturaM = altCm / 100;
  const imc = pesoKg / (alturaM * alturaM);
  const rounded = Math.round(imc * 10) / 10;
  if (rounded < 5 || rounded > 100) return null;
  return rounded;
}

function formatImc(value: unknown): string {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) return '';
  return value.toFixed(1);
}

function renderInitialField(
  field: ProcedureFieldRow,
  value: unknown,
  onChange: (key: string, value: unknown) => void,
  userId: string,
  photoCompact?: boolean
) {
  const key = field.field_key;
  const label = key === 'ml' ? 'mg' : field.label;
  const type = field.field_type;
  const options = parseOptions(field.options);

  if (type === 'image') {
    return (
      <div key={field.id}>
        <PhotoUploadField
          label={label}
          value={value as string | null | undefined}
          onChange={(url) => onChange(key, url)}
          userId={userId}
          instanceIdOrTemp="temp"
          compact={photoCompact}
        />
      </div>
    );
  }

  if (type === 'text') {
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <Input
          value={(value as string) ?? ''}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder={label}
        />
      </div>
    );
  }
  if (type === 'number') {
    if (key === 'imc') {
      return (
        <div key={field.id} className="space-y-2">
          <Label>{label}</Label>
          <Input
            type="text"
            value={formatImc(value)}
            readOnly
            className="bg-muted"
            placeholder="Preencha peso e altura"
          />
        </div>
      );
    }
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <Input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) =>
            onChange(key, e.target.value === '' ? null : Number(e.target.value))
          }
          placeholder={label}
        />
      </div>
    );
  }
  if (type === 'date') {
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <Input
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(key, e.target.value || null)}
        />
      </div>
    );
  }
  if (type === 'boolean') {
    return (
      <div key={field.id} className="flex items-center gap-2 pt-6">
        <input
          type="checkbox"
          id={key}
          checked={!!value}
          onChange={(e) => onChange(key, e.target.checked)}
          className="rounded border-input"
        />
        <Label htmlFor={key}>{label}</Label>
      </div>
    );
  }
  if (type === 'select') {
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <Select
          value={(value as string) ?? ''}
          onValueChange={(v) => onChange(key, v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={label} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div key={field.id} className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={(value as string) ?? ''}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={label}
      />
    </div>
  );
}

export default function ProcedureStartPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const professionalId = profile?.id ?? user?.id;
  const [procedure, setProcedure] = useState<ProcedureRow | null>(null);
  const [fields, setFields] = useState<ProcedureFieldRow[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [patientId, setPatientId] = useState<string>('');
  const [patientOpen, setPatientOpen] = useState(false);
  const [dataInicio, setDataInicio] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [initialData, setInitialData] = useState<Record<string, unknown>>({});

  // Depilação a laser usa o formulário completo da consulta (galeria, valores, próxima avaliação).
  useEffect(() => {
    if (slug === 'depilacao-laser') {
      navigate('/depilacao-laser/start', { replace: true });
    }
  }, [slug, navigate]);

  const loadProcedure = useCallback(async () => {
    if (!slug || !profile?.id) return;
    const procs = await getProceduresForProfile(profile.id);
    const data = procs.find((p) => p.slug === slug);
    if (!data) {
      setProcedure(null);
      setFields([]);
      return;
    }
    setProcedure(data as ProcedureRow);
    const { data: fieldsData } = await supabase
      .from('procedure_fields')
      .select('*')
      .eq('procedure_id', data.id)
      .order('sort_order');
    setFields((fieldsData ?? []) as ProcedureFieldRow[]);
  }, [slug, profile?.id]);

  const loadPatients = useCallback(async () => {
    if (!professionalId) return;
    const { data } = await supabase
      .from('patients')
      .select('id, full_name')
      .eq('professional_id', professionalId)
      .eq('is_active', true)
      .order('full_name');
    setPatients((data ?? []) as PatientOption[]);
  }, [professionalId]);

  useEffect(() => {
    loadProcedure();
    loadPatients();
  }, [loadProcedure, loadPatients]);

  useEffect(() => {
    if (procedure !== undefined) setLoading(false);
  }, [procedure]);

  const selectedPatient = patients.find((p) => p.id === patientId);

  const setFieldValue = (key: string, value: unknown) => {
    setInitialData((prev) => ({ ...prev, [key]: value }));
  };

  // IMC automático: ao alterar peso_inicial ou altura_cm, recalcular e preencher imc
  useEffect(() => {
    const peso = initialData.peso_inicial as number | null | undefined;
    const altura = initialData.altura_cm as number | null | undefined;
    const imc = calcImc(peso, altura);
    setInitialData((prev) => {
      const current = prev.imc as number | undefined;
      if (imc != null && current === imc) return prev;
      if (imc == null && !('imc' in prev)) return prev;
      const next = { ...prev };
      if (imc != null) next.imc = imc;
      else delete next.imc;
      return next;
    });
  }, [initialData.peso_inicial, initialData.altura_cm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !procedure?.id) return;
    if (!patientId.trim()) {
      toast.error('Selecione o paciente.');
      return;
    }
    if (!dataInicio.trim()) {
      toast.error('Informe a data de início.');
      return;
    }

    setSaving(true);
    try {
      const { data: instance, error: instanceError } = await supabase
        .from('procedure_instances')
        .insert({
          procedure_id: procedure.id,
          patient_id: patientId,
          professional_id: profile.id,
          data_inicio: dataInicio,
          status: 'em_andamento',
        })
        .select('id')
        .single();

      if (instanceError) {
        toast.error('Não foi possível iniciar o procedimento.');
        setSaving(false);
        return;
      }

      const instanceId = (instance as { id: string }).id;

      const sessionData: Record<string, unknown> = { ...initialData };
      const { error: sessionError } = await supabase
        .from('procedure_sessions')
        .insert({
          procedure_instance_id: instanceId,
          session_date: dataInicio,
          data: sessionData,
        });

      if (sessionError) {
        toast.error('Procedimento iniciado, mas falha ao salvar dados iniciais.');
      } else {
        toast.success('Procedimento iniciado com sucesso.');
      }

      navigate(`/procedures/${slug}/${instanceId}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao iniciar procedimento.');
    } finally {
      setSaving(false);
    }
  };

  if (slug === 'depilacao-laser') {
    return <PageLoading />;
  }

  if (loading) {
    return <PageLoading />;
  }

  if (!procedure) {
    return (
      <div className="p-4 space-y-4">
        <p className="text-muted-foreground">Procedimento não encontrado.</p>
        <Button variant="link" asChild>
          <Link to="/settings">Ir para Configurações → Procedimentos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link to={`/procedures/${slug}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {procedure.category}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Iniciar procedimento: {procedure.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preencha os dados iniciais do procedimento para este paciente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
        <Card>
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base font-semibold">
              <Scale className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              Dados iniciais
            </CardTitle>
            <CardDescription className="text-xs">Paciente, data de início e campos do procedimento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="patient">Paciente *</Label>
                <Popover open={patientOpen} onOpenChange={setPatientOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="patient"
                      variant="outline"
                      role="combobox"
                      aria-expanded={patientOpen}
                      aria-required
                      className="w-full justify-between"
                    >
                      {selectedPatient ? selectedPatient.full_name : 'Selecione o paciente'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Filtrar paciente..." />
                      <CommandEmpty>
                        {patients.length === 0
                          ? 'Nenhum paciente cadastrado. Cadastre em Pacientes.'
                          : 'Nenhum paciente encontrado para o filtro.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {patients.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={p.full_name}
                            onSelect={() => {
                              setPatientId(p.id);
                              setPatientOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                patientId === p.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {p.full_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_inicio">Data de início *</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input
                    id="data_inicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {(() => {
              const fieldsForStart = fields.filter((f) => !f.field_key.endsWith('_atual'));
              const photoFields = fieldsForStart.filter((f) => f.field_type === 'image');
              const otherFields = fieldsForStart.filter((f) => f.field_type !== 'image');
              return fieldsForStart.length > 0 ? (
                <div className="border-t border-border pt-4 space-y-4">
                  {otherFields.length > 0 && (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        Campos do procedimento
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {otherFields
                          .filter((field) => {
                            if (slug !== 'emagrecimento-reducao-medidas') return true;
                            if (field.field_key === 'produto_usado' || field.field_key === 'ml')
                              return (initialData.injetavel as string) === 'Sim';
                            return true;
                          })
                          .map((field) =>
                            renderInitialField(field, initialData[field.field_key], setFieldValue, profile?.id ?? '')
                          )}
                      </div>
                    </>
                  )}
                  {photoFields.length > 0 && (
                    <div className="rounded-xl border border-border bg-muted/20 p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-1">Fotos atuais</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {photoFields.map((field) =>
                          renderInitialField(field, initialData[field.field_key], setFieldValue, profile?.id ?? '', true)
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : null;
            })()}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to={`/procedures/${slug}`}>Cancelar</Link>
          </Button>
          <Button type="submit" disabled={saving} className="gap-2 w-full sm:w-auto">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            {saving ? 'Iniciando...' : 'Iniciar procedimento'}
          </Button>
        </div>
      </form>
      <MobileBottomSafeSpacer />
    </div>
  );
}
