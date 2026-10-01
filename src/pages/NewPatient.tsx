import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useCreatePatient } from '@/hooks/useCreatePatient';
import { QUERY_KEYS, notificationsKey } from '@/api/queryKeys';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { SignaturePad } from '@/components/SignaturePad';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Save, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';
import { findExistingPatientByPhone, formatPhoneDisplay, normalizePhoneDigits } from '@/lib/phone';
import { isClinicOnlyAccount } from '@/lib/accountType';
import { cepDigits } from '@/lib/viaCep';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { DateInputField } from '@/components/ui/date-input-field';
import { BrazilianCityField } from '@/components/ui/brazilian-city-field';
import { ClinicCepAddressFields } from '@/components/patient/ClinicCepAddressFields';
import { ClinicOriginSelect } from '@/components/patient/ClinicOriginSelect';
import { ClinicReferredByField } from '@/components/patient/ClinicReferredByField';
import { ClinicRecordTypeFields } from '@/components/patient/ClinicRecordTypeFields';
import { ClinicResponsibleProfessionalField } from '@/components/patient/ClinicResponsibleProfessionalField';
import { isIndicationOriginName } from '@/lib/clinicPatientOrigin';
import { originNameById } from '@/services/api/clinicPatientOriginsApi';
import { replacePatientRecordTypes } from '@/services/api/clinicRecordTypesApi';
import { useClinicPatientOrigins } from '@/hooks/use-clinic-patient-origins';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import { LGPD_CONSENT_TEXT } from '@/lib/lgpdConsent';
import { cn } from '@/lib/utils';
import { isPatientMinor } from '@/lib/patientAge';
import { formatPhoneForWhatsApp } from '@/lib/evolutionPdf';
import { buildAnamneseWhatsAppMessage } from '@/lib/reportShare';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import { sendWhatsappTextPreferEvolution } from '@/lib/sendWhatsappTextPreferEvolution';
import {
  buildPublicAnamneseUrl,
  ensurePatientAnamnesePublicSlug,
} from '@/services/api/patientAnamneseApi';

function toYmd(date: Date | undefined): string | null {
  if (!date) return null;
  return format(date, 'yyyy-MM-dd');
}

const patientSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().optional(),
});

type AnamneseData = {
  q01?: 'sim' | 'nao';
  q01_qual?: string;
  q01_detalhes?: string;
  q02?: 'sim' | 'nao';
  q02_qual?: string;
  q03?: 'sim' | 'nao';
  q03_qual?: string;
  q04?: 'sim' | 'nao';
  q04_qual?: string;
  q05?: 'sim' | 'nao';
  q05_qual?: string;
  q06?: 'sim' | 'nao';
  q06_qual?: string;
  q07_gestante?: 'sim' | 'nao';
  q07_filhos?: 'sim' | 'nao';
  q07_obs?: string;
  q08_pressao?: string;
  q08_coracao?: 'sim' | 'nao';
  q08_qual?: string;
  q09?: 'sim' | 'nao';
  q09_obs?: string;
  q10?: 'sim' | 'nao';
  q10_qual?: string;
  q11?: 'sim' | 'nao';
  q11_qual?: string;
  q12?: 'sim' | 'nao';
  q13?: 'sim' | 'nao';
  q14?: 'sim' | 'nao';
  observacoes?: string;
};

const PERGUNTAS_ANAMNESE: { key: keyof AnamneseData; label: string; simQual?: string }[] = [
  { key: 'q01', label: 'Já fez algum tipo de tratamento estético?', simQual: 'Qual? (Toxina Botulínica, Preenchimento, Outro)' },
  { key: 'q02', label: 'Tem alergia a algum medicamento?', simQual: 'Qual?' },
  { key: 'q03', label: 'Faz uso de algum medicamento?', simQual: 'Qual?' },
  { key: 'q04', label: 'Você é ou já foi fumante?', simQual: 'Quanto tempo?/Obs.' },
  { key: 'q05', label: 'Utiliza ou já utilizou ácido na pele?', simQual: 'Qual?' },
  { key: 'q06', label: 'Está sob algum tipo de tratamento médico?', simQual: 'Qual?/Obs.' },
  { key: 'q09', label: 'Possui muita exposição ao Sol?', simQual: 'Obs.' },
  { key: 'q10', label: 'Já teve algum tipo de câncer?', simQual: 'Qual?' },
  { key: 'q11', label: 'Possui algum tipo de cuidado estético?', simQual: 'Qual?' },
];

export default function NewPatient() {
  const navigate = useNavigate();
  const copy = useUiCopy();
  const { user, profile } = useAuth();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);
  const { origins } = useClinicPatientOrigins();
  const queryClient = useQueryClient();
  const professionalId = (profile?.id ?? user?.id) as string | undefined;
  const { mutateAsync: createPatient, isPending: loading } = useCreatePatient(professionalId);

  const [loadingConsent, setLoadingConsent] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    nickname: '',
    cpf: '',
    date_of_birth: undefined as Date | undefined,
    sex: '',
    profession: '',
    address: '',
    address_number: '',
    neighborhood: '',
    zip_code: '',
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
  const [lgpdSignatureData, setLgpdSignatureData] = useState<string | null>(null);
  const [showSalonLgpd, setShowSalonLgpd] = useState(false);
  const [isMinor, setIsMinor] = useState(false);
  const [legalResponsibleName, setLegalResponsibleName] = useState('');
  const [sendAnamneseAfterSave, setSendAnamneseAfterSave] = useState(false);
  const [anamneseData, setAnamneseData] = useState<AnamneseData>({});
  const updateAnamnese = (key: keyof AnamneseData, value: string | undefined) => {
    setAnamneseData((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const birthSuggestsMinor = isPatientMinor(formData.date_of_birth);

  function handleBirthDateChange(date: Date | undefined) {
    setFormData({ ...formData, date_of_birth: date });
    if (isClinicAccount && date && isPatientMinor(date)) {
      setIsMinor(true);
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

    const lgpdRequired = !copy.isSalon || showSalonLgpd;
    if (lgpdRequired && !lgpdSignatureData?.trim()) {
      toast.error(
        copy.isSalon
          ? `O ${copy.patient.toLowerCase()} deve assinar o termo de consentimento LGPD`
          : 'O paciente deve assinar o termo de consentimento LGPD'
      );
      return;
    }

    const phoneDigits = normalizePhoneDigits(formData.phone);
    if (copy.isSalon && (!phoneDigits || phoneDigits.length < 10)) {
      toast.error('Informe um telefone válido.');
      return;
    }
    if (phoneDigits && professionalId && !copy.isSalon) {
      const phoneOwnerId =
        (isClinicAccount && formData.responsible_professional_id) || professionalId;
      const existing = await findExistingPatientByPhone({
        professionalId: phoneOwnerId,
        phone: phoneDigits,
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

    setLoadingConsent(true);

    try {
      const treatmentStartDate = toYmd(formData.treatment_start_date);
      const birthDate = toYmd(formData.date_of_birth);

      const patient = await createPatient({
        professional_id:
          (isClinicAccount && formData.responsible_professional_id) || professionalId!,
        full_name: formData.full_name,
        nickname: copy.isSalon ? formData.nickname.trim() || null : null,
        cpf: copy.isSalon ? null : formData.cpf.trim() || null,
        date_of_birth: birthDate,
        sex: (formData.sex as 'male' | 'female' | 'other') || null,
        profession: copy.isSalon ? null : formData.profession.trim() || null,
        address: copy.isSalon ? null : formData.address.trim() || null,
        address_number: isClinicAccount ? formData.address_number.trim() || null : null,
        neighborhood: isClinicAccount ? formData.neighborhood.trim() || null : null,
        zip_code: isClinicAccount ? cepDigits(formData.zip_code) || null : null,
        city: formData.city.trim() || null,
        phone: phoneDigits || null,
        origin_id: isClinicAccount ? formData.origin_id || null : null,
        referred_by:
          copy.isSalon || (isClinicAccount && !isIndicationOriginName(originNameById(origins, formData.origin_id)))
            ? null
            : formData.referred_by.trim() || null,
        referred_by_patient_id:
          isClinicAccount && isIndicationOriginName(originNameById(origins, formData.origin_id))
            ? formData.referred_by_patient_id || null
            : null,
        treatment_start_date: isClinicAccount ? null : treatmentStartDate,
        consultation_objective:
          copy.isSalon || isClinicAccount ? null : formData.consultation_objective.trim() || null,
        emergency_contact_name:
          copy.isSalon || isClinicAccount ? null : formData.emergency_contact_name.trim() || null,
        emergency_contact_phone:
          copy.isSalon || isClinicAccount ? null : formData.emergency_contact_phone.trim() || null,
        general_notes: copy.isSalon ? null : formData.general_notes.trim() || null,
        is_minor: isClinicAccount ? isMinor : false,
        legal_responsible_name:
          isClinicAccount && isMinor ? legalResponsibleName.trim() || null : null,
        registration_completed_at: new Date().toISOString(),
      });

      if (lgpdRequired) {
        const { error: consentError } = await supabase
          .from('lgpd_consents')
          .insert({
            patient_id: patient.id,
            consent_given: true,
            consent_date: new Date().toISOString(),
            consent_text: LGPD_CONSENT_TEXT,
            signature_data: lgpdSignatureData!.trim(),
          });

        if (consentError) throw consentError;
      }

      if (!copy.isSalon) {
        // Se for enviar a ficha ao paciente, não assina aqui: o RPC ensure_* reabre
        // anamneses já assinadas (limpa signature). Mantém rascunho para o paciente completar.
        const { error: anamneseError } = await supabase.from('patient_anamnese').upsert(
          {
            patient_id: patient.id,
            data: anamneseData,
            signature_data: sendAnamneseAfterSave ? null : lgpdSignatureData.trim(),
            signed_at: sendAnamneseAfterSave ? null : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'patient_id' }
        );
        if (anamneseError) throw anamneseError;

        if (sendAnamneseAfterSave) {
          const wa = formatPhoneForWhatsApp(phoneDigits);
          if (!wa) {
            toast.message('Paciente cadastrado. Informe o telefone para enviar a ficha de anamnese.');
          } else {
            try {
              const slug = await ensurePatientAnamnesePublicSlug(patient.id);
              const url = buildPublicAnamneseUrl(slug);
              const templates = await loadWhatsappManualTemplates(professionalId);
              const entry = templates.anamnese_invite;
              if (!entry.enabled) {
                toast.message(
                  'Paciente cadastrado. O envio da anamnese está desativado em Mensagens padrão.'
                );
              } else {
                const message = buildAnamneseWhatsAppMessage({
                  patientName: formData.full_name,
                  clinicName: profile?.app_name || profile?.full_name,
                  anamneseUrl: url,
                  template: entry.message,
                });
                const sent = await sendWhatsappTextPreferEvolution({
                  professionalId: professionalId!,
                  phone: wa,
                  message,
                  patientId: patient.id,
                });
                if (sent.viaEvolution || sent.viaWaMe) {
                  toast.success(
                    sent.viaEvolution
                      ? 'Ficha de anamnese enviada pelo WhatsApp.'
                      : 'Abrindo WhatsApp com a ficha de anamnese…'
                  );
                } else {
                  toast.message(
                    sent.error ||
                      'Paciente cadastrado. Não foi possível enviar a anamnese pelo WhatsApp.'
                  );
                }
              }
            } catch (sendErr) {
              console.error(sendErr);
              toast.message(
                'Paciente cadastrado. Não foi possível enviar a ficha de anamnese automaticamente.'
              );
            }
          }
        }
      }

      if (isClinicAccount) {
        await replacePatientRecordTypes(patient.id, formData.recordTypeIds);
      }

      await queryClient.invalidateQueries({ queryKey: notificationsKey(user?.id ?? '') });
      toast.success(copy.isSalon ? 'Cliente cadastrado com sucesso!' : 'Paciente cadastrado com sucesso!');
      navigate(`/patients/${patient.id}`);
    } catch (error: unknown) {
      console.error('Error creating patient:', error);
      toast.error('Erro ao cadastrar paciente. Tente novamente.');
    } finally {
      setLoadingConsent(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in px-0 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {copy.isSalon ? `Novo ${copy.patient}` : 'Novo Paciente'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {copy.isSalon
              ? `Cadastre um novo ${copy.patient.toLowerCase()} no sistema`
              : 'Cadastre um novo paciente no sistema'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
        {/* Personal Info */}
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
                <div className="space-y-2 sm:col-span-2">
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

                <div className="sm:col-span-2 flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <Checkbox
                    id="show_salon_lgpd"
                    checked={showSalonLgpd}
                    onCheckedChange={(checked) => {
                      const enabled = checked === true;
                      setShowSalonLgpd(enabled);
                      if (!enabled) setLgpdSignatureData(null);
                    }}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="show_salon_lgpd" className="cursor-pointer font-medium leading-none">
                      Coletar termo LGPD
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Ative para exibir o termo de consentimento e registrar a assinatura do{' '}
                      {copy.patient.toLowerCase()}.
                    </p>
                  </div>
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
              <Label htmlFor="date_of_birth">Data de Nascimento</Label>
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

            {isClinicAccount ? (
              <ClinicCepAddressFields
                value={{
                  zip_code: formData.zip_code,
                  address: formData.address,
                  address_number: formData.address_number,
                  neighborhood: formData.neighborhood,
                  city: formData.city,
                }}
                onChange={(next) =>
                  setFormData((current) => ({
                    ...current,
                    zip_code: next.zip_code,
                    address: next.address,
                    address_number: next.address_number,
                    neighborhood: next.neighborhood,
                    city: next.city,
                  }))
                }
              />
            ) : (
              <>
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
              </>
            )}

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
              <Label htmlFor="treatment_start_date">Data de Início do Tratamento</Label>
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

        {!copy.isSalon ? (
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-sm md:text-base">Histórico médico e estético</CardTitle>
            <CardDescription className="text-xs">Sim/Não e detalhe quando necessário.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <Checkbox
                id="send_anamnese_after_save"
                checked={sendAnamneseAfterSave}
                onCheckedChange={(checked) => setSendAnamneseAfterSave(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="send_anamnese_after_save" className="cursor-pointer font-medium leading-none">
                  Enviar ficha de anamnese ao paciente após salvar
                </Label>
                <p className="text-xs text-muted-foreground">
                  Gera o link público e envia pelo WhatsApp do paciente (Evolution, com fallback).
                </p>
              </div>
            </div>
            {PERGUNTAS_ANAMNESE.map(({ key, label, simQual }) => (
              <div key={key} className="space-y-2">
                <Label className="text-sm">{label}</Label>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={anamneseData[key] === 'nao'} onCheckedChange={(c) => updateAnamnese(key, c ? 'nao' : undefined)} />
                    <span className="text-sm">Não</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={anamneseData[key] === 'sim'} onCheckedChange={(c) => updateAnamnese(key, c ? 'sim' : undefined)} />
                    <span className="text-sm">Sim</span>
                  </label>
                  {anamneseData[key] === 'sim' && simQual && (
                    <Input
                      className="max-w-xs"
                      placeholder={simQual}
                      value={anamneseData[`${key}_qual` as keyof AnamneseData] ?? ''}
                      onChange={(e) => updateAnamnese(`${key}_qual` as keyof AnamneseData, e.target.value)}
                    />
                  )}
                </div>
                {key === 'q01' && anamneseData.q01 === 'sim' && (
                  <Input
                    className="mt-2"
                    placeholder="Detalhes da aplicação"
                    value={anamneseData.q01_detalhes ?? ''}
                    onChange={(e) => updateAnamnese('q01_detalhes', e.target.value)}
                  />
                )}
              </div>
            ))}

            <div className="space-y-2">
              <Label>Está gestante?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={anamneseData.q07_gestante === 'sim'} onCheckedChange={(c) => updateAnamnese('q07_gestante', c ? 'sim' : undefined)} />
                  <span className="text-sm">Sim</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={anamneseData.q07_gestante === 'nao'} onCheckedChange={(c) => updateAnamnese('q07_gestante', c ? 'nao' : undefined)} />
                  <span className="text-sm">Não</span>
                </label>
              </div>
              <Label className="text-sm mt-2 block">Possui filhos?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={anamneseData.q07_filhos === 'sim'} onCheckedChange={(c) => updateAnamnese('q07_filhos', c ? 'sim' : undefined)} />
                  <span className="text-sm">Sim</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={anamneseData.q07_filhos === 'nao'} onCheckedChange={(c) => updateAnamnese('q07_filhos', c ? 'nao' : undefined)} />
                  <span className="text-sm">Não</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quanto costuma ser sua pressão arterial?</Label>
              <Input
                placeholder="Ex: 12x8"
                value={anamneseData.q08_pressao ?? ''}
                onChange={(e) => updateAnamnese('q08_pressao', e.target.value)}
              />
              <Label className="text-sm mt-2 block">Possui algum problema de coração?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={anamneseData.q08_coracao === 'nao'} onCheckedChange={(c) => updateAnamnese('q08_coracao', c ? 'nao' : undefined)} />
                  <span className="text-sm">Não</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={anamneseData.q08_coracao === 'sim'} onCheckedChange={(c) => updateAnamnese('q08_coracao', c ? 'sim' : undefined)} />
                  <span className="text-sm">Sim</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Possui intolerância à lactose?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={anamneseData.q12 === 'sim'} onCheckedChange={(c) => updateAnamnese('q12', c ? 'sim' : undefined)} />
                  <span className="text-sm">Sim</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={anamneseData.q12 === 'nao'} onCheckedChange={(c) => updateAnamnese('q12', c ? 'nao' : undefined)} />
                  <span className="text-sm">Não</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tem diabetes?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={anamneseData.q13 === 'sim'} onCheckedChange={(c) => updateAnamnese('q13', c ? 'sim' : undefined)} />
                  <span className="text-sm">Sim</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={anamneseData.q13 === 'nao'} onCheckedChange={(c) => updateAnamnese('q13', c ? 'nao' : undefined)} />
                  <span className="text-sm">Não</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Possui alergia à proteína do ovo (Albumina)?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={anamneseData.q14 === 'sim'} onCheckedChange={(c) => updateAnamnese('q14', c ? 'sim' : undefined)} />
                  <span className="text-sm">Sim</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={anamneseData.q14 === 'nao'} onCheckedChange={(c) => updateAnamnese('q14', c ? 'nao' : undefined)} />
                  <span className="text-sm">Não</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Anotações gerais"
                value={anamneseData.observacoes ?? ''}
                onChange={(e) => updateAnamnese('observacoes', e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>
        ) : null}

        {/* LGPD Consent */}
        {(!copy.isSalon || showSalonLgpd) ? (
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
                {copy.isSalon
                  ? `O ${copy.patient.toLowerCase()} deve assinar abaixo para concordar com o termo de consentimento *`
                  : 'O paciente deve assinar abaixo para concordar com o termo de consentimento *'}
              </p>
              <SignaturePad
                label={copy.isSalon ? `Assinatura do ${copy.patient.toLowerCase()}` : 'Assinatura do paciente'}
                height={120}
                onSave={(dataUrl) => setLgpdSignatureData(dataUrl)}
                onClear={() => setLgpdSignatureData(null)}
              />
              {lgpdSignatureData && (
                <p className="text-xs text-muted-foreground">
                  Assinatura registrada.{' '}
                  {copy.isSalon
                    ? `O ${copy.patient.toLowerCase()} pode limpar e assinar novamente se necessário.`
                    : 'O paciente pode limpar e assinar novamente se necessário.'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        ) : null}

        {/* Submit — sticky acima do bottom nav em tablet/mobile */}
        <div
          className={cn(
            'flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3',
            'sticky z-[1050] mt-2 border-t border-border bg-background/95 py-3 backdrop-blur',
            '-mx-3 px-3 md:-mx-4 md:px-4',
            'bottom-[calc(var(--mobile-bottom-nav-height,64px)+env(safe-area-inset-bottom,0px))]',
            'nav:static nav:bottom-auto nav:z-auto nav:mt-0 nav:border-0 nav:bg-transparent nav:py-0 nav:backdrop-blur-none nav:mx-0 nav:px-0'
          )}
        >
          <Button type="button" variant="outline" onClick={() => navigate(-1)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || loadingConsent} className="gap-2 w-full sm:w-auto">
            <Save className="w-4 h-4" />
            {loading || loadingConsent
              ? 'Salvando...'
              : copy.isSalon
                ? `Salvar ${copy.patient}`
                : 'Salvar Paciente'}
          </Button>
        </div>
      </form>
      <MobileBottomSafeSpacer />
    </div>
  );
}
