import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClinicAppointmentStatusSelect } from '@/components/clinic/ClinicAppointmentStatusSelect';
import {
  CLINIC_AGENDA_APPOINTMENT_TYPES,
  type ClinicAgendaProfessional,
  type ClinicAgendaStatus,
} from '@/lib/clinicAgendaBooking';

type ClinicAgendaBookingFieldsProps = {
  idPrefix?: string;
  professionals: ClinicAgendaProfessional[];
  professionalsLoading?: boolean;
  professionalId: string;
  onProfessionalIdChange: (id: string) => void;
  procedureId: string;
  onProcedureIdChange: (id: string) => void;
  agendaStatus: ClinicAgendaStatus;
  onAgendaStatusChange: (status: ClinicAgendaStatus) => void;
};

export function ClinicAgendaBookingFields({
  idPrefix = 'clinic-agenda',
  professionals,
  professionalsLoading,
  professionalId,
  onProfessionalIdChange,
  procedureId,
  onProcedureIdChange,
  agendaStatus,
  onAgendaStatusChange,
}: ClinicAgendaBookingFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-tipo`}>Tipo de atendimento *</Label>
        <Select value={procedureId || undefined} onValueChange={onProcedureIdChange}>
          <SelectTrigger id={`${idPrefix}-tipo`}>
            <SelectValue placeholder="Selecione o tipo de atendimento" />
          </SelectTrigger>
          <SelectContent>
            {CLINIC_AGENDA_APPOINTMENT_TYPES.map((tipo) => (
              <SelectItem key={tipo.id} value={tipo.id}>
                {tipo.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-profissional`}>Profissional *</Label>
        <Select
          value={professionalId || undefined}
          onValueChange={onProfessionalIdChange}
          disabled={professionalsLoading}
        >
          <SelectTrigger id={`${idPrefix}-profissional`}>
            <SelectValue
              placeholder={professionalsLoading ? 'Carregando...' : 'Selecione o profissional'}
            />
          </SelectTrigger>
          <SelectContent>
            {professionals.map((pro) => (
              <SelectItem key={pro.userId} value={pro.userId}>
                {pro.name}
                {pro.specialty ? ` — ${pro.specialty}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-status`}>Status da agenda *</Label>
        <ClinicAppointmentStatusSelect
          id={`${idPrefix}-status`}
          value={agendaStatus}
          onValueChange={onAgendaStatusChange}
        />
      </div>
    </>
  );
}
