import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';
import { Loader2, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { parseLocalDate } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { findExistingPatientByPhone, formatPhoneDisplay, normalizePhoneDigits } from '@/lib/phone';
import { PatientTabPanelSection } from './PatientDetailTabPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PatientProfilePhotoField } from '@/components/patient/PatientProfilePhotoField';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { DateInputField } from '@/components/ui/date-input-field';
import { BrazilianCityField } from '@/components/ui/brazilian-city-field';
import { ClinicCepAddressFields } from '@/components/patient/ClinicCepAddressFields';
import { ClinicOriginSelect } from '@/components/patient/ClinicOriginSelect';
import { ClinicReferredByField } from '@/components/patient/ClinicReferredByField';
import { ClinicRecordTypeFields } from '@/components/patient/ClinicRecordTypeFields';
import { ClinicResponsibleProfessionalField } from '@/components/patient/ClinicResponsibleProfessionalField';
import { isClinicOnlyAccount } from '@/lib/accountType';
import { cepDigits, formatCepDisplay } from '@/lib/viaCep';
import { isIndicationOriginName } from '@/lib/clinicPatientOrigin';
import { originNameById } from '@/services/api/clinicPatientOriginsApi';
import { replacePatientRecordTypes } from '@/services/api/clinicRecordTypesApi';
import { useClinicPatientOrigins } from '@/hooks/use-clinic-patient-origins';
import { useClinicRecordTypes, usePatientRecordTypeIds } from '@/hooks/use-clinic-record-types';
import { QUERY_KEYS } from '@/api/queryKeys';

const patientSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().optional(),
});

export interface PatientPersonalInfoData {
  full_name: string;
  nickname?: string | null;
  cpf: string | null;
  phone: string | null;
  date_of_birth: string | null;
  sex: string | null;
  profession: string | null;
  address: string | null;
  address_number?: string | null;
  neighborhood?: string | null;
  zip_code?: string | null;
  city: string | null;
  referred_by: string | null;
  origin_id?: string | null;
  referred_by_patient_id?: string | null;
  treatment_start_date: string | null;
  consultation_objective: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  general_notes: string | null;
  profile_photo_url: string | null;
  professional_id?: string | null;
}

type FormData = {
  full_name: string;
  nickname: string;
  cpf: string;
  date_of_birth: Date | undefined;
  sex: string;
  profession: string;
  address: string;
  address_number: string;
  neighborhood: string;
  zip_code: string;
  city: string;
  phone: string;
  referred_by: string;
  origin_id: string;
  referred_by_patient_id: string;
  treatment_start_date: Date | undefined;
  consultation_objective: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  general_notes: string;
  responsible_professional_id: string;
};

type PatientPersonalInfoSectionProps = {
  patientId: string;
  patient: PatientPersonalInfoData;
  getSexLabel: (sex: string | null) => string;
  onPatientUpdated: () => void;
  onEditingChange?: (editing: boolean) => void;
  /** Abre já em modo edição (ex.: pop-up a partir da agenda). */
  initialEditing?: boolean;
  /** header = ações no topo; footer = Editar no topo e Cancelar/Salvar abaixo; none = sem botões (controle externo). */
  actionsPlacement?: 'header' | 'footer' | 'none';
};

function patientToForm(patient: PatientPersonalInfoData): FormData {
  return {
    full_name: patient.full_name ?? '',
    nickname: patient.nickname ?? '',
    cpf: patient.cpf ?? '',
    date_of_birth: patient.date_of_birth ? parseLocalDate(patient.date_of_birth) : undefined,
    sex: patient.sex ?? '',
    profession: patient.profession ?? '',
    address: patient.address ?? '',
    address_number: patient.address_number ?? '',
    neighborhood: patient.neighborhood ?? '',
    zip_code: formatCepDisplay(patient.zip_code),
    city: patient.city ?? '',
    phone: patient.phone ?? '',
    referred_by: patient.referred_by ?? '',
    origin_id: patient.origin_id ?? '',
    referred_by_patient_id: patient.referred_by_patient_id ?? '',
    treatment_start_date: patient.treatment_start_date
      ? parseLocalDate(patient.treatment_start_date)
      : undefined,
    consultation_objective: patient.consultation_objective ?? '',
    emergency_contact_name: patient.emergency_contact_name ?? '',
    emergency_contact_phone: patient.emergency_contact_phone ?? '',
    general_notes: patient.general_notes ?? '',
    responsible_professional_id: patient.professional_id ?? '',
  };
}

function ReadOnlyField({ value }: { value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm">
      {value || '—'}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>;
}

export function PatientPersonalInfoSection({
  patientId,
  patient,
  getSexLabel,
  onPatientUpdated,
  onEditingChange,
  initialEditing = false,
  actionsPlacement = 'header',
}: PatientPersonalInfoSectionProps) {
  const { user, profile } = useAuth();
  const copy = useUiCopy();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);
  const { origins } = useClinicPatientOrigins();
  const { recordTypes } = useClinicRecordTypes();
  const { recordTypeIds: savedRecordTypeIds } = usePatientRecordTypeIds(
    isClinicAccount ? patientId : null
  );
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(Boolean(initialEditing));
  const [saving, setSaving] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(patient.profile_photo_url);
  const [formData, setFormData] = useState<FormData>(() => patientToForm(patient));
  const [recordTypeIds, setRecordTypeIds] = useState<string[]>([]);
  const professionalId = (profile?.id ?? user?.id) as string | undefined;

  useEffect(() => {
    setIsEditing(Boolean(initialEditing));
    if (initialEditing) onEditingChange?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só sincroniza quando o pai pede edição ou troca o paciente
  }, [initialEditing, patientId]);

  useEffect(() => {
    if (!isEditing) {
      setFormData(patientToForm(patient));
      setProfilePhotoUrl(patient.profile_photo_url);
      setRecordTypeIds(savedRecordTypeIds);
    }
  }, [patient, isEditing, savedRecordTypeIds]);

  function handleCancel() {
    setFormData(patientToForm(patient));
    setProfilePhotoUrl(patient.profile_photo_url);
    setRecordTypeIds(savedRecordTypeIds);
    setIsEditing(false);
    onEditingChange?.(false);
  }

  async function handleSave() {
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

    const phoneDigits = normalizePhoneDigits(formData.phone);
    if (copy.isSalon && (!phoneDigits || phoneDigits.length < 10)) {
      toast.error('Informe um telefone válido.');
      return;
    }
    const professionalId = (profile?.id ?? user?.id) as string | undefined;
    if (phoneDigits && professionalId && !copy.isSalon) {
      const existing = await findExistingPatientByPhone({
        professionalId,
        phone: phoneDigits,
        excludePatientId: patientId,
      });
      if (existing?.id) {
        toast.error(
          `Já existe um paciente com este telefone: ${existing.full_name}. Cada número é exclusivo de um paciente.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update(
          copy.isSalon
            ? {
                full_name: formData.full_name.trim(),
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
                treatment_start_date: formData.treatment_start_date?.toISOString().split('T')[0] || null,
                consultation_objective: null,
                emergency_contact_name: null,
                emergency_contact_phone: null,
                general_notes: null,
                profile_photo_url: profilePhotoUrl,
              }
            : {
                full_name: formData.full_name.trim(),
                nickname: null,
                cpf: formData.cpf.trim() || null,
                date_of_birth: formData.date_of_birth?.toISOString().split('T')[0] || null,
                sex: (formData.sex as 'male' | 'female' | 'other') || null,
                profession: formData.profession.trim() || null,
                address: formData.address.trim() || null,
                address_number: isClinicAccount ? formData.address_number.trim() || null : null,
                neighborhood: isClinicAccount ? formData.neighborhood.trim() || null : null,
                zip_code: isClinicAccount ? cepDigits(formData.zip_code) || null : null,
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
                treatment_start_date: isClinicAccount
                  ? null
                  : formData.treatment_start_date?.toISOString().split('T')[0] || null,
                consultation_objective: isClinicAccount
                  ? null
                  : formData.consultation_objective.trim() || null,
                ...(isClinicAccount && formData.responsible_professional_id
                  ? { professional_id: formData.responsible_professional_id }
                  : {}),
                emergency_contact_name: isClinicAccount
                  ? patient.emergency_contact_name
                  : formData.emergency_contact_name.trim() || null,
                emergency_contact_phone: isClinicAccount
                  ? patient.emergency_contact_phone
                  : formData.emergency_contact_phone.trim() || null,
                general_notes: formData.general_notes.trim() || null,
                profile_photo_url: profilePhotoUrl,
              }
        )
        .eq('id', patientId);

      if (error) throw error;

      if (isClinicAccount) {
        await replacePatientRecordTypes(patientId, recordTypeIds);
        await queryClient.invalidateQueries({ queryKey: ['patient-record-types', patientId] });
      }

      // Atualiza lista do profissional responsável (e demais caches de pacientes)
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.patients });

      toast.success('Ficha atualizada com sucesso!');
      setIsEditing(false);
      onEditingChange?.(false);
      onPatientUpdated();
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  const editButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 rounded-lg"
      onClick={() => {
        setRecordTypeIds(savedRecordTypeIds);
        setIsEditing(true);
        onEditingChange?.(true);
      }}
    >
      <Pencil className="h-3.5 w-3.5" />
      Editar
    </Button>
  );

  const saveCancelButtons = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        className="gap-1.5"
        onClick={handleCancel}
        disabled={saving}
      >
        <X className="h-4 w-4" />
        Cancelar
      </Button>
      <Button
        type="button"
        className="gap-1.5"
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {copy.isSalon ? 'Atualizar' : 'Salvar'}
      </Button>
    </div>
  );

  const headerAction =
    actionsPlacement === 'none'
      ? null
      : actionsPlacement === 'footer'
      ? isEditing
        ? null
        : editButton
      : isEditing
        ? (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-lg text-muted-foreground"
                onClick={handleCancel}
                disabled={saving}
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 rounded-lg"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {copy.isSalon ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          )
        : editButton;

  return (
    <div className="space-y-4">
    <PatientTabPanelSection
      title={`Ficha do ${copy.patient.toLowerCase()}`}
      action={headerAction}
      contentClassName="p-4 sm:p-5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 min-w-0">
        {professionalId && isEditing ? (
          <div className="sm:col-span-2 pb-3 border-b border-border/50">
            <PatientProfilePhotoField
              patientId={patientId}
              patientName={formData.full_name}
              value={profilePhotoUrl}
              professionalId={professionalId}
              disabled={saving}
              onChange={setProfilePhotoUrl}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <FieldLabel>Nome completo</FieldLabel>
          {isEditing ? (
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Nome completo"
              required
            />
          ) : (
            <ReadOnlyField value={patient.full_name} />
          )}
        </div>

        {copy.isSalon ? (
          <>
            <div className="space-y-1.5">
              <FieldLabel>Apelido</FieldLabel>
              {isEditing ? (
                <Input
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  placeholder="Apelido"
                />
              ) : (
                <ReadOnlyField value={patient.nickname ?? ''} />
              )}
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Data de nascimento</FieldLabel>
              {isEditing ? (
                <DateInputField
                  inputId="patient-date-of-birth"
                  value={formData.date_of_birth}
                  onChange={(date) => setFormData({ ...formData, date_of_birth: date })}
                  maxDate={new Date()}
                  fromYear={1920}
                />
              ) : (
                <ReadOnlyField
                  value={
                    patient.date_of_birth
                      ? format(parseLocalDate(patient.date_of_birth), 'dd/MM/yyyy', { locale: ptBR })
                      : ''
                  }
                />
              )}
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Sexo</FieldLabel>
              {isEditing ? (
                <Select value={formData.sex} onValueChange={(value) => setFormData({ ...formData, sex: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Feminino</SelectItem>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <ReadOnlyField value={getSexLabel(patient.sex)} />
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Telefone / WhatsApp</FieldLabel>
              {isEditing ? (
                <>
                  <Input
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
                </>
              ) : (
                <ReadOnlyField value={patient.phone ? formatPhoneDisplay(patient.phone) : ''} />
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Cidade</FieldLabel>
              {isEditing ? (
                <BrazilianCityField
                  id="patient-city"
                  value={formData.city}
                  onChange={(city) => setFormData({ ...formData, city })}
                  placeholder="Digite para buscar a cidade"
                />
              ) : (
                <ReadOnlyField value={patient.city ?? ''} />
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Início do tratamento</FieldLabel>
              {isEditing ? (
                <DateInputField
                  inputId="salon-treatment-start"
                  value={formData.treatment_start_date}
                  onChange={(date) => setFormData({ ...formData, treatment_start_date: date })}
                  fromYear={2020}
                  toYear={new Date().getFullYear()}
                />
              ) : (
                <ReadOnlyField
                  value={
                    patient.treatment_start_date
                      ? format(parseLocalDate(patient.treatment_start_date), 'dd/MM/yyyy', { locale: ptBR })
                      : ''
                  }
                />
              )}
            </div>
          </>
        ) : (
          <>
        <div className="space-y-1.5">
          <FieldLabel>CPF</FieldLabel>
          {isEditing ? (
            <Input
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              placeholder="000.000.000-00"
            />
          ) : (
            <ReadOnlyField value={patient.cpf ?? ''} />
          )}
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Data de nascimento</FieldLabel>
          {isEditing ? (
            <DateInputField
              inputId="patient-date-of-birth"
              value={formData.date_of_birth}
              onChange={(date) => setFormData({ ...formData, date_of_birth: date })}
              maxDate={new Date()}
              fromYear={1920}
            />
          ) : (
            <ReadOnlyField
              value={
                patient.date_of_birth
                  ? format(parseLocalDate(patient.date_of_birth), 'dd/MM/yyyy', { locale: ptBR })
                  : ''
              }
            />
          )}
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Sexo</FieldLabel>
          {isEditing ? (
            <Select value={formData.sex} onValueChange={(value) => setFormData({ ...formData, sex: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Feminino</SelectItem>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <ReadOnlyField value={getSexLabel(patient.sex)} />
          )}
        </div>

        {isClinicAccount ? (
          <>
            <div className="space-y-1.5">
              <FieldLabel>Telefone / WhatsApp</FieldLabel>
              {isEditing ? (
                <Input
                  inputMode="tel"
                  value={formatPhoneDisplay(formData.phone)}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: normalizePhoneDigits(e.target.value) })
                  }
                  placeholder="(00) 00000-0000"
                />
              ) : (
                <ReadOnlyField value={patient.phone ? formatPhoneDisplay(patient.phone) : ''} />
              )}
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Origem</FieldLabel>
              {isEditing ? (
                <ClinicOriginSelect
                  id="patient-origin"
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
              ) : (
                <ReadOnlyField value={originNameById(origins, patient.origin_id)} />
              )}
            </div>

            {isIndicationOriginName(
              originNameById(origins, isEditing ? formData.origin_id : patient.origin_id)
            ) ? (
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel>Indicado por</FieldLabel>
                {isEditing ? (
                  <ClinicReferredByField
                    id="patient-referred-by"
                    name={formData.referred_by}
                    patientId={formData.referred_by_patient_id}
                    excludePatientId={patientId}
                    onChange={({ name, patientId: referredPatientId }) =>
                      setFormData((current) => ({
                        ...current,
                        referred_by: name,
                        referred_by_patient_id: referredPatientId,
                      }))
                    }
                  />
                ) : (
                  <ReadOnlyField
                    value={
                      patient.referred_by
                        ? `${patient.referred_by}${patient.referred_by_patient_id ? ' (paciente da clínica)' : ''}`
                        : ''
                    }
                  />
                )}
              </div>
            ) : null}
          </>
        ) : null}

        {isClinicAccount ? (
          <div className="space-y-1.5 sm:col-span-2">
            <ClinicResponsibleProfessionalField
              id="patient-responsible-professional"
              value={formData.responsible_professional_id}
              onChange={(userId) =>
                setFormData((current) => ({ ...current, responsible_professional_id: userId }))
              }
              ensureUserId={patient.professional_id}
              disabled={!isEditing}
              labelClassName="text-xs font-medium text-muted-foreground"
            />
          </div>
        ) : null}

        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel>Profissão</FieldLabel>
          {isEditing ? (
            <Input
              value={formData.profession}
              onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
              placeholder="Profissão"
            />
          ) : (
            <ReadOnlyField value={patient.profession ?? ''} />
          )}
        </div>

        {isClinicAccount ? (
          isEditing ? (
            <ClinicCepAddressFields
              idPrefix="patient"
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
              <div className="space-y-1.5">
                <FieldLabel>CEP</FieldLabel>
                <ReadOnlyField value={formatCepDisplay(patient.zip_code)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Número</FieldLabel>
                <ReadOnlyField value={patient.address_number ?? ''} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel>Endereço</FieldLabel>
                <ReadOnlyField value={patient.address ?? ''} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Bairro</FieldLabel>
                <ReadOnlyField value={patient.neighborhood ?? ''} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Cidade</FieldLabel>
                <ReadOnlyField value={patient.city ?? ''} />
              </div>
            </>
          )
        ) : (
          <>
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Endereço</FieldLabel>
              {isEditing ? (
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Endereço completo"
                />
              ) : (
                <ReadOnlyField value={patient.address ?? ''} />
              )}
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Cidade</FieldLabel>
              {isEditing ? (
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Cidade"
                />
              ) : (
                <ReadOnlyField value={patient.city ?? ''} />
              )}
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Telefone / WhatsApp</FieldLabel>
              {isEditing ? (
                <Input
                  inputMode="tel"
                  value={formatPhoneDisplay(formData.phone)}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: normalizePhoneDigits(e.target.value) })
                  }
                  placeholder="(00) 00000-0000"
                />
              ) : (
                <ReadOnlyField value={patient.phone ? formatPhoneDisplay(patient.phone) : ''} />
              )}
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Indicado por</FieldLabel>
              {isEditing ? (
                <Input
                  value={formData.referred_by}
                  onChange={(e) => setFormData({ ...formData, referred_by: e.target.value })}
                  placeholder="Quem indicou o paciente"
                />
              ) : (
                <ReadOnlyField value={patient.referred_by ?? ''} />
              )}
            </div>
          </>
        )}

        {isClinicAccount ? (
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel>Tipo de ficha</FieldLabel>
            {isEditing ? (
              <ClinicRecordTypeFields selectedIds={recordTypeIds} onChange={setRecordTypeIds} />
            ) : (
              <ReadOnlyField
                value={recordTypes
                  .filter((type) => savedRecordTypeIds.includes(type.id))
                  .map((type) => type.name)
                  .join(', ')}
              />
            )}
          </div>
        ) : null}

        {!isClinicAccount ? (
          <>
        <div className="space-y-1.5">
          <FieldLabel>Início do tratamento</FieldLabel>
          {isEditing ? (
            <DateInputField
              inputId="patient-treatment-start"
              value={formData.treatment_start_date}
              onChange={(date) => setFormData({ ...formData, treatment_start_date: date })}
              fromYear={2020}
              toYear={new Date().getFullYear()}
            />
          ) : (
            <ReadOnlyField
              value={
                patient.treatment_start_date
                  ? format(parseLocalDate(patient.treatment_start_date), 'dd/MM/yyyy', { locale: ptBR })
                  : ''
              }
            />
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel>Objetivo da consulta</FieldLabel>
          {isEditing ? (
            <Input
              value={formData.consultation_objective}
              onChange={(e) => setFormData({ ...formData, consultation_objective: e.target.value })}
              placeholder="Objetivo da consulta"
            />
          ) : (
            <ReadOnlyField value={patient.consultation_objective ?? ''} />
          )}
        </div>
          </>
        ) : null}

        {!isClinicAccount ? (
          <>
            <div className="space-y-1.5">
              <FieldLabel>Contato de emergência – Nome</FieldLabel>
              {isEditing ? (
                <Input
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  placeholder="Nome do contato"
                />
              ) : (
                <ReadOnlyField value={patient.emergency_contact_name ?? ''} />
              )}
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Contato de emergência – Tel.</FieldLabel>
              {isEditing ? (
                <Input
                  inputMode="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              ) : (
                <ReadOnlyField value={patient.emergency_contact_phone ?? ''} />
              )}
            </div>
          </>
        ) : null}

        {isEditing || patient.general_notes ? (
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel>Observações gerais</FieldLabel>
            {isEditing ? (
              <Textarea
                value={formData.general_notes}
                onChange={(e) => setFormData({ ...formData, general_notes: e.target.value })}
                placeholder="Informações adicionais sobre o paciente..."
                rows={4}
              />
            ) : (
              <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm whitespace-pre-wrap">
                {patient.general_notes}
              </div>
            )}
          </div>
        ) : null}
          </>
        )}
      </div>
    </PatientTabPanelSection>
    {actionsPlacement === 'footer' && isEditing ? saveCancelButtons : null}
    </div>
  );
}
