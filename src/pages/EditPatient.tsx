import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Save, Shield } from 'lucide-react';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { SignaturePad } from '@/components/SignaturePad';
import { PatientProfilePhotoField } from '@/components/patient/PatientProfilePhotoField';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import { cn, parseLocalDate } from '@/lib/utils';
import { z } from 'zod';
import { findExistingPatientByPhone, formatPhoneDisplay, normalizePhoneDigits } from '@/lib/phone';
import { DateInputField } from '@/components/ui/date-input-field';
import { BrazilianCityField } from '@/components/ui/brazilian-city-field';
import { ClinicOriginSelect } from '@/components/patient/ClinicOriginSelect';
import { ClinicReferredByField } from '@/components/patient/ClinicReferredByField';
import { ClinicRecordTypeFields } from '@/components/patient/ClinicRecordTypeFields';
import { ClinicResponsibleProfessionalField } from '@/components/patient/ClinicResponsibleProfessionalField';
import { isClinicOnlyAccount } from '@/lib/accountType';
import { isIndicationOriginName } from '@/lib/clinicPatientOrigin';
import { originNameById } from '@/services/api/clinicPatientOriginsApi';
import {
  fetchPatientRecordTypeIds,
  replacePatientRecordTypes,
} from '@/services/api/clinicRecordTypesApi';
import { useClinicPatientOrigins } from '@/hooks/use-clinic-patient-origins';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/api/queryKeys';
import { isPatientMinor } from '@/lib/patientAge';

const patientSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().optional(),
});

const LGPD_CONSENT_TEXT = `
Eu, abaixo identificado(a), autorizo expressamente a coleta, armazenamento e uso de minhas imagens e dados pessoais para fins de acompanhamento clínico de tratamentos estéticos.

Estou ciente de que:
• As imagens serão utilizadas exclusivamente para documentação e acompanhamento da evolução dos tratamentos;
• Meus dados serão mantidos em sigilo e não serão compartilhados com terceiros sem meu consentimento;
• Posso solicitar a exclusão dos meus dados a qualquer momento;
• Este consentimento está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
`.trim();

export default function EditPatient() {
  const copy = useUiCopy();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isCompletingRegistration = searchParams.get('complete') === '1';
  const { user, profile } = useAuth();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);
  const { origins } = useClinicPatientOrigins();
  const queryClient = useQueryClient();
  const professionalId = (profile?.id ?? user?.id) as string | undefined;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    full_name: '',
    nickname: '',
    cpf: '',
    date_of_birth: undefined as Date | undefined,
    sex: '',
    profession: '',
    address: '',
    city: '',
    phone: '',
    referred_by: '',
    origin_id: '',
    referred_by_patient_id: '',
    recordTypeIds: [] as string[],
    treatment_start_date: new Date(),
    consultation_objective: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    general_notes: '',
    responsible_professional_id: '',
  });
  const [isMinor, setIsMinor] = useState(false);
  const [legalResponsibleName, setLegalResponsibleName] = useState('');
  const [lgpdSignatureData, setLgpdSignatureData] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  const birthSuggestsMinor = isPatientMinor(formData.date_of_birth);

  function handleBirthDateChange(date: Date | undefined) {
    setFormData({ ...formData, date_of_birth: date });
    if (isClinicAccount && date && isPatientMinor(date)) {
      setIsMinor(true);
    }
  }

  useEffect(() => {
    if (id) fetchPatient();
  }, [id]);

  async function fetchPatient() {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) {
        navigate('/patients');
        return;
      }

      const recordTypeIds = id
        ? await fetchPatientRecordTypeIds(id).catch((err) => {
            console.error('Error fetching patient record types:', err);
            return [] as string[];
          })
        : [];

      setFormData({
        full_name: data.full_name ?? '',
        nickname: data.nickname ?? '',
        cpf: data.cpf ?? '',
        date_of_birth: data.date_of_birth ? parseLocalDate(data.date_of_birth) : undefined,
        sex: data.sex ?? '',
        profession: data.profession ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        phone: data.phone ?? '',
        referred_by: data.referred_by ?? '',
        origin_id: data.origin_id ?? '',
        referred_by_patient_id: data.referred_by_patient_id ?? '',
        recordTypeIds,
        treatment_start_date: data.treatment_start_date
          ? parseLocalDate(data.treatment_start_date)
          : new Date(),
        consultation_objective: data.consultation_objective ?? '',
        emergency_contact_name: data.emergency_contact_name ?? '',
        emergency_contact_phone: data.emergency_contact_phone ?? '',
        general_notes: data.general_notes ?? '',
        responsible_professional_id: data.professional_id ?? '',
      });
      setIsMinor(Boolean((data as { is_minor?: boolean }).is_minor));
      setLegalResponsibleName((data as { legal_responsible_name?: string | null }).legal_responsible_name ?? '');
      setProfilePhotoUrl(data.profile_photo_url ?? null);
    } catch (err) {
      console.error('Error fetching patient:', err);
      toast.error('Paciente não encontrado.');
      navigate('/patients');
    } finally {
      setFetching(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      patientSchema.parse({
        full_name: formData.full_name,
        phone: formData.phone,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    if (isCompletingRegistration && !lgpdSignatureData?.trim()) {
      toast.error('O paciente deve assinar o termo de consentimento LGPD.');
      return;
    }

    const phoneDigits = normalizePhoneDigits(formData.phone);
    if (copy.isSalon && (!phoneDigits || phoneDigits.length < 10)) {
      toast.error('Informe um telefone válido.');
      return;
    }
    if (phoneDigits && professionalId && !copy.isSalon) {
      const existing = await findExistingPatientByPhone({
        professionalId,
        phone: phoneDigits,
        excludePatientId: id,
      });
      if (existing?.id) {
        toast.error(
          `Já existe um paciente com este telefone: ${existing.full_name}. Cada número é exclusivo de um paciente.`
        );
        return;
      }
    }

    if (isClinicAccount && isMinor && !legalResponsibleName.trim()) {
      toast.error('Informe o nome do responsável legal para paciente menor de idade.');
      return;
    }

    setLoading(true);

    try {
      const treatmentStartDate = formData.treatment_start_date?.toISOString().split('T')[0] ?? null;

      const updatePayload: Record<string, unknown> = copy.isSalon
        ? {
            full_name: formData.full_name,
            nickname: formData.nickname.trim() || null,
            cpf: null,
            date_of_birth: formData.date_of_birth?.toISOString().split('T')[0] || null,
            sex: (formData.sex as 'male' | 'female' | 'other') || null,
            profession: null,
            address: null,
            city: formData.city.trim() || null,
            phone: phoneDigits || null,
            referred_by: null,
            origin_id: null,
            referred_by_patient_id: null,
            treatment_start_date: treatmentStartDate,
            consultation_objective: null,
            emergency_contact_name: null,
            emergency_contact_phone: null,
            general_notes: null,
            profile_photo_url: profilePhotoUrl,
          }
        : {
            full_name: formData.full_name,
            nickname: null,
            cpf: formData.cpf.trim() || null,
            date_of_birth: formData.date_of_birth?.toISOString().split('T')[0] || null,
            sex: (formData.sex as 'male' | 'female' | 'other') || null,
            profession: formData.profession.trim() || null,
            address: formData.address.trim() || null,
            city: formData.city.trim() || null,
            phone: phoneDigits || null,
            origin_id: isClinicAccount ? formData.origin_id || null : null,
            referred_by:
              isClinicAccount &&
              !isIndicationOriginName(originNameById(origins, formData.origin_id))
                ? null
                : formData.referred_by.trim() || null,
            referred_by_patient_id:
              isClinicAccount &&
              isIndicationOriginName(originNameById(origins, formData.origin_id))
                ? formData.referred_by_patient_id || null
                : null,
            treatment_start_date: isClinicAccount ? null : treatmentStartDate,
            consultation_objective: isClinicAccount
              ? null
              : formData.consultation_objective.trim() || null,
            ...(isClinicAccount
              ? {}
              : {
                  emergency_contact_name: formData.emergency_contact_name.trim() || null,
                  emergency_contact_phone: formData.emergency_contact_phone.trim() || null,
                }),
            ...(isClinicAccount && formData.responsible_professional_id
              ? { professional_id: formData.responsible_professional_id }
              : {}),
            general_notes: formData.general_notes || null,
            profile_photo_url: profilePhotoUrl,
            ...(isClinicAccount
              ? {
                  is_minor: isMinor,
                  legal_responsible_name: isMinor ? legalResponsibleName.trim() || null : null,
                }
              : {}),
          };
      if (isCompletingRegistration) {
        updatePayload.registration_completed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('patients')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;

      if (isClinicAccount && id) {
        await replacePatientRecordTypes(id, formData.recordTypeIds);
      }

      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.patients });

      if (isCompletingRegistration && lgpdSignatureData?.trim() && id) {
        await supabase.from('lgpd_consents').upsert(
          {
            patient_id: id,
            consent_given: true,
            consent_date: new Date().toISOString(),
            consent_text: LGPD_CONSENT_TEXT,
            signature_data: lgpdSignatureData.trim(),
          },
          { onConflict: 'patient_id' }
        );
      }

      toast.success(isCompletingRegistration ? 'Cadastro completado com sucesso!' : 'Dados atualizados com sucesso!');
      navigate(`/patients/${id}`);
    } catch (error: unknown) {
      console.error('Error updating patient:', error);
      toast.error('Erro ao atualizar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in min-w-0">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: copy.patients, path: '/patients' },
          { label: formData.full_name || 'Paciente', path: id ? `/patients/${id}` : undefined },
          { label: isCompletingRegistration ? 'Completar cadastro' : 'Editar' },
        ]}
        className="mb-1"
      />
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <Button variant="ghost" size="icon" asChild className="shrink-0" title="Voltar à ficha do paciente">
          <Link to={`/patients/${id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {isCompletingRegistration
              ? 'Completar cadastro do paciente'
              : copy.isSalon
                ? `Atualizar ${copy.patient}`
                : 'Editar Paciente'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isCompletingRegistration
              ? 'Este paciente foi agendado por pré-cadastro. Preencha os dados abaixo para finalizar o cadastro.'
              : copy.isSalon
                ? `Atualize os dados do ${copy.patient.toLowerCase()} para o formato atual`
                : 'Atualize os dados do paciente'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-base md:text-lg">Informações Pessoais</CardTitle>
            <CardDescription className="text-xs">
              {copy.isSalon
                ? `Dados básicos do ${copy.patient.toLowerCase()}`
                : 'Dados básicos do paciente'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 p-3 md:p-6 pt-0">
            {professionalId && id ? (
              <div className="sm:col-span-2 pb-3 border-b border-border/50">
                <PatientProfilePhotoField
                  patientId={id}
                  patientName={formData.full_name}
                  value={profilePhotoUrl}
                  professionalId={professionalId}
                  disabled={loading}
                  onChange={setProfilePhotoUrl}
                />
              </div>
            ) : null}

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="full_name">Nome Completo *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Digite o nome completo"
                required
              />
            </div>

            {copy.isSalon ? (
              <>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="nickname">Apelido</Label>
                  <Input
                    id="nickname"
                    value={formData.nickname}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                    placeholder="Como o cliente é conhecido no salão"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Data de Nascimento</Label>
                  <DateInputField
                    inputId="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleBirthDateChange}
                    maxDate={new Date()}
                    fromYear={1920}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sex">Sexo</Label>
                  <Select
                    value={formData.sex}
                    onValueChange={(value) => setFormData({ ...formData, sex: value })}
                  >
                    <SelectTrigger id="sex">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Feminino</SelectItem>
                      <SelectItem value="male">Masculino</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="phone">Telefone / WhatsApp *</Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    value={formatPhoneDisplay(formData.phone)}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: normalizePhoneDigits(e.target.value) })
                    }
                    placeholder="(00) 00000-0000"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    O mesmo telefone pode ser usado em mais de um {copy.patient.toLowerCase()} (ex.: pai e filho).
                  </p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="city">Cidade</Label>
                  <BrazilianCityField
                    id="city"
                    value={formData.city}
                    onChange={(city) => setFormData({ ...formData, city })}
                    placeholder="Digite para buscar a cidade"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Data de Início do Tratamento</Label>
                  <DateInputField
                    inputId="treatment_start_date"
                    value={formData.treatment_start_date}
                    onChange={(date) =>
                      setFormData({ ...formData, treatment_start_date: date || new Date() })
                    }
                    fromYear={2020}
                    toYear={new Date().getFullYear()}
                  />
                </div>
              </>
            ) : (
              <>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <DateInputField
                inputId="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleBirthDateChange}
                maxDate={new Date()}
                fromYear={1920}
              />
              {isClinicAccount && birthSuggestsMinor ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  A data de nascimento indica paciente menor de idade.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sex">Sexo</Label>
              <Select
                value={formData.sex}
                onValueChange={(value) => setFormData({ ...formData, sex: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Feminino</SelectItem>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isClinicAccount ? (
              <>
                <div className="sm:col-span-2 flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <Checkbox
                    id="is_minor"
                    checked={isMinor}
                    onCheckedChange={(checked) => {
                      const next = checked === true;
                      setIsMinor(next);
                      if (!next) setLegalResponsibleName('');
                    }}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="is_minor" className="cursor-pointer font-medium leading-none">
                      Paciente menor de idade
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Marque para registrar o responsável legal do menor.
                    </p>
                  </div>
                </div>
                {isMinor ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="legal_responsible_name">Nome do responsável legal *</Label>
                    <Input
                      id="legal_responsible_name"
                      value={legalResponsibleName}
                      onChange={(e) => setLegalResponsibleName(e.target.value)}
                      placeholder="Nome completo do responsável"
                      required
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            {isClinicAccount ? (
              <div className="space-y-2 sm:col-span-2">
                <ClinicResponsibleProfessionalField
                  id="responsible_professional"
                  value={formData.responsible_professional_id}
                  onChange={(userId) =>
                    setFormData((current) => ({
                      ...current,
                      responsible_professional_id: userId,
                    }))
                  }
                  ensureUserId={formData.responsible_professional_id || null}
                />
              </div>
            ) : null}

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profession">Profissão</Label>
              <Input
                id="profession"
                value={formData.profession}
                onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                placeholder="Profissão"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Endereço completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Cidade"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <Input
                id="phone"
                inputMode="tel"
                value={formatPhoneDisplay(formData.phone)}
                onChange={(e) =>
                  setFormData({ ...formData, phone: normalizePhoneDigits(e.target.value) })
                }
                placeholder="(00) 00000-0000"
              />
              <p className="text-xs text-muted-foreground">
                Cada número é exclusivo de um paciente.
              </p>
            </div>

            <div className="space-y-2">
              {isClinicAccount ? (
                <>
                  <Label htmlFor="origin_id">Origem</Label>
                  <ClinicOriginSelect
                    id="origin_id"
                    value={formData.origin_id}
                    onChange={(originId, originName) =>
                      setFormData((current) => ({
                        ...current,
                        origin_id: originId,
                        referred_by: isIndicationOriginName(originName) ? current.referred_by : '',
                        referred_by_patient_id: isIndicationOriginName(originName)
                          ? current.referred_by_patient_id
                          : '',
                      }))
                    }
                  />
                </>
              ) : (
                <>
              <Label htmlFor="referred_by">Indicado por</Label>
              <Input
                id="referred_by"
                value={formData.referred_by}
                onChange={(e) => setFormData({ ...formData, referred_by: e.target.value })}
                placeholder="Quem indicou o paciente"
              />
                </>
              )}
            </div>

            {isClinicAccount && isIndicationOriginName(originNameById(origins, formData.origin_id)) ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="referred_by">Indicado por</Label>
                <ClinicReferredByField
                  id="referred_by"
                  name={formData.referred_by}
                  patientId={formData.referred_by_patient_id}
                  excludePatientId={id}
                  onChange={({ name, patientId }) =>
                    setFormData((current) => ({
                      ...current,
                      referred_by: name,
                      referred_by_patient_id: patientId,
                    }))
                  }
                />
              </div>
            ) : null}

            {isClinicAccount ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>Tipo de ficha</Label>
                <ClinicRecordTypeFields
                  selectedIds={formData.recordTypeIds}
                  onChange={(ids) => setFormData((current) => ({ ...current, recordTypeIds: ids }))}
                />
              </div>
            ) : null}

            {!isClinicAccount ? (
              <>
            <div className="space-y-2">
              <Label>Data de Início do Tratamento</Label>
              <DateInputField
                inputId="treatment_start_date"
                value={formData.treatment_start_date}
                onChange={(date) =>
                  setFormData({ ...formData, treatment_start_date: date || new Date() })
                }
                fromYear={2020}
                toYear={new Date().getFullYear()}
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="consultation_objective">Objetivo da Consulta</Label>
              <Input
                id="consultation_objective"
                value={formData.consultation_objective}
                onChange={(e) => setFormData({ ...formData, consultation_objective: e.target.value })}
                placeholder="Objetivo da consulta"
              />
            </div>
              </>
            ) : null}

            {!isClinicAccount ? (
              <>
            <div className="space-y-2">
              <Label htmlFor="emergency_contact_name">Contato de Emergência - Nome</Label>
              <Input
                id="emergency_contact_name"
                value={formData.emergency_contact_name}
                onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                placeholder="Nome do contato"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergency_contact_phone">Contato de Emergência - Tel./Cel.</Label>
              <Input
                id="emergency_contact_phone"
                value={formData.emergency_contact_phone}
                onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
              </>
            ) : null}

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="notes">Observações Gerais</Label>
              <Textarea
                id="notes"
                value={formData.general_notes}
                onChange={(e) => setFormData({ ...formData, general_notes: e.target.value })}
                placeholder="Informações adicionais sobre o paciente..."
                rows={4}
              />
            </div>
              </>
            )}
          </CardContent>
        </Card>

        {isCompletingRegistration && (
          <Card className="border-primary/20">
<CardHeader className="p-3 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                Termo de Consentimento (LGPD)
              </CardTitle>
              <CardDescription className="text-xs">Consentimento para uso e armazenamento de imagens</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">
              <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground whitespace-pre-line max-h-[min(12rem,28dvh)] overflow-y-auto">
                {LGPD_CONSENT_TEXT}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  O paciente deve assinar abaixo para concordar com o termo de consentimento *
                </p>
                <SignaturePad
                  label="Assinatura do paciente"
                  height={120}
                  onSave={(dataUrl) => setLgpdSignatureData(dataUrl)}
                  onClear={() => setLgpdSignatureData(null)}
                />
                {lgpdSignatureData && (
                  <p className="text-xs text-muted-foreground">Assinatura registrada. O paciente pode limpar e assinar novamente se necessário.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div
          className={cn(
            'flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3',
            'sticky z-[1050] mt-2 border-t border-border bg-background/95 py-3 backdrop-blur',
            '-mx-3 px-3 md:-mx-4 md:px-4',
            'bottom-[calc(var(--mobile-bottom-nav-height,64px)+env(safe-area-inset-bottom,0px))]',
            'nav:static nav:bottom-auto nav:z-auto nav:mt-0 nav:border-0 nav:bg-transparent nav:py-0 nav:backdrop-blur-none nav:mx-0 nav:px-0'
          )}
        >
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to={`/patients/${id}`}>Cancelar</Link>
          </Button>
          <Button type="submit" disabled={loading} className="gap-2 w-full sm:w-auto">
            <Save className="w-4 h-4" />
            {loading ? 'Salvando...' : isCompletingRegistration ? 'Salvar Paciente' : copy.isSalon ? 'Atualizar' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
      <MobileBottomSafeSpacer />
    </div>
  );
}
