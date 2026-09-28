import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateInputField } from '@/components/ui/date-input-field';
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
import { SignaturePad } from '@/components/SignaturePad';
import { LGPD_CONSENT_TEXT } from '@/lib/lgpdConsent';
import { formatPhoneDisplay, normalizePhoneDigits } from '@/lib/phone';

export type PatientRegistrationFormState = {
  full_name: string;
  cpf: string;
  date_of_birth: Date | undefined;
  sex: string;
  profession: string;
  address: string;
  city: string;
  phone: string;
  referred_by: string;
  treatment_start_date: Date;
  consultation_objective: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  general_notes: string;
};

type PatientRegistrationFormFieldsProps = {
  formData: PatientRegistrationFormState;
  onChange: (next: PatientRegistrationFormState) => void;
  showLgpd?: boolean;
  lgpdSignatureData: string | null;
  onLgpdSignatureChange: (dataUrl: string | null) => void;
  idPrefix?: string;
};

export function PatientRegistrationFormFields({
  formData,
  onChange,
  showLgpd = true,
  lgpdSignatureData,
  onLgpdSignatureChange,
  idPrefix = '',
}: PatientRegistrationFormFieldsProps) {
  const prefix = idPrefix ? `${idPrefix}-` : '';

  function patch(partial: Partial<PatientRegistrationFormState>) {
    onChange({ ...formData, ...partial });
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-base md:text-lg">Informações Pessoais</CardTitle>
          <CardDescription className="text-xs">Dados básicos do paciente</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 p-3 md:p-6 pt-0">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor={`${prefix}full_name`}>Nome Completo *</Label>
            <Input
              id={`${prefix}full_name`}
              value={formData.full_name}
              onChange={(e) => patch({ full_name: e.target.value })}
              placeholder="Digite o nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}cpf`}>CPF</Label>
            <Input
              id={`${prefix}cpf`}
              value={formData.cpf}
              onChange={(e) => patch({ cpf: e.target.value })}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="space-y-2">
            <Label>Data de Nascimento</Label>
            <DateInputField
              inputId={`${prefix}date_of_birth`}
              value={formData.date_of_birth}
              onChange={(date) => patch({ date_of_birth: date })}
              maxDate={new Date()}
              fromYear={1920}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}sex`}>Sexo</Label>
            <Select value={formData.sex} onValueChange={(value) => patch({ sex: value })}>
              <SelectTrigger id={`${prefix}sex`}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Feminino</SelectItem>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}profession`}>Profissão</Label>
            <Input
              id={`${prefix}profession`}
              value={formData.profession}
              onChange={(e) => patch({ profession: e.target.value })}
              placeholder="Profissão"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${prefix}address`}>Endereço</Label>
            <Input
              id={`${prefix}address`}
              value={formData.address}
              onChange={(e) => patch({ address: e.target.value })}
              placeholder="Endereço completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}city`}>Cidade</Label>
            <Input
              id={`${prefix}city`}
              value={formData.city}
              onChange={(e) => patch({ city: e.target.value })}
              placeholder="Cidade"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}phone`}>Telefone / WhatsApp</Label>
            <Input
              id={`${prefix}phone`}
              inputMode="tel"
              value={formatPhoneDisplay(formData.phone)}
              onChange={(e) => patch({ phone: normalizePhoneDigits(e.target.value) })}
              placeholder="(00) 00000-0000"
            />
            <p className="text-xs text-muted-foreground">Cada número é exclusivo de um paciente.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}referred_by`}>Indicado por</Label>
            <Input
              id={`${prefix}referred_by`}
              value={formData.referred_by}
              onChange={(e) => patch({ referred_by: e.target.value })}
              placeholder="Quem indicou o paciente"
            />
          </div>

          <div className="space-y-2">
            <Label>Data de Início do Tratamento</Label>
            <DateInputField
              inputId={`${prefix}treatment_start_date`}
              value={formData.treatment_start_date}
              onChange={(date) => patch({ treatment_start_date: date || new Date() })}
              fromYear={2020}
              toYear={new Date().getFullYear()}
            />
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor={`${prefix}consultation_objective`}>Objetivo da Consulta</Label>
            <Input
              id={`${prefix}consultation_objective`}
              value={formData.consultation_objective}
              onChange={(e) => patch({ consultation_objective: e.target.value })}
              placeholder="Objetivo da consulta"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}emergency_contact_name`}>Contato de Emergência - Nome</Label>
            <Input
              id={`${prefix}emergency_contact_name`}
              value={formData.emergency_contact_name}
              onChange={(e) => patch({ emergency_contact_name: e.target.value })}
              placeholder="Nome do contato"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}emergency_contact_phone`}>Contato de Emergência - Tel./Cel.</Label>
            <Input
              id={`${prefix}emergency_contact_phone`}
              value={formData.emergency_contact_phone}
              onChange={(e) => patch({ emergency_contact_phone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label htmlFor={`${prefix}notes`}>Observações Gerais</Label>
            <Textarea
              id={`${prefix}notes`}
              value={formData.general_notes}
              onChange={(e) => patch({ general_notes: e.target.value })}
              placeholder="Informações adicionais sobre o paciente..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {showLgpd ? (
        <Card className="border-primary/20">
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Shield className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              Termo de Consentimento (LGPD)
            </CardTitle>
            <CardDescription className="text-xs">
              Consentimento para uso e armazenamento de imagens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">
            <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground whitespace-pre-line max-h-48 overflow-y-auto">
              {LGPD_CONSENT_TEXT}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Assine abaixo para concordar com o termo de consentimento *
              </p>
              <SignaturePad
                label="Assinatura do paciente"
                height={140}
                onSave={(dataUrl) => onLgpdSignatureChange(dataUrl)}
                onClear={() => onLgpdSignatureChange(null)}
              />
              {lgpdSignatureData ? (
                <p className="text-xs text-muted-foreground">
                  Assinatura registrada. Você pode limpar e assinar novamente se necessário.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function toRegistrationApiPayload(
  formData: PatientRegistrationFormState
): import('@/services/api/patientRegistrationApi').PublicPatientRegistrationFormData {
  return {
    full_name: formData.full_name.trim(),
    cpf: formData.cpf.trim(),
    date_of_birth: formData.date_of_birth?.toISOString().split('T')[0] ?? null,
    sex: formData.sex || '',
    profession: formData.profession.trim(),
    address: formData.address.trim(),
    city: formData.city.trim(),
    phone: formData.phone,
    referred_by: formData.referred_by.trim(),
    treatment_start_date: formData.treatment_start_date?.toISOString().split('T')[0] ?? null,
    consultation_objective: formData.consultation_objective.trim(),
    emergency_contact_name: formData.emergency_contact_name.trim(),
    emergency_contact_phone: formData.emergency_contact_phone.trim(),
    general_notes: formData.general_notes.trim(),
  };
}
