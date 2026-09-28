import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PhotoUploadField } from '@/components/PhotoUploadField';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

type PatientProfilePhotoFieldProps = {
  patientId: string;
  patientName: string;
  value: string | null;
  professionalId: string;
  disabled?: boolean;
  onChange: (url: string | null) => void;
};

export function PatientProfilePhotoField({
  patientId,
  patientName,
  value,
  professionalId,
  disabled,
  onChange,
}: PatientProfilePhotoFieldProps) {
  return (
    <div className="flex items-center gap-5 sm:gap-6">
      <Avatar className="h-24 w-24 shrink-0 ring-0">
        <AvatarImage src={value || undefined} alt={patientName} className="object-cover" />
        <AvatarFallback className="bg-gradient-to-br from-primary/20 via-primary/35 to-primary/50 text-primary text-2xl font-semibold">
          {getInitials(patientName || 'Paciente')}
        </AvatarFallback>
      </Avatar>
      <PhotoUploadField
        variant="profile"
        label="Foto do paciente"
        value={value}
        onChange={onChange}
        userId={professionalId}
        instanceIdOrTemp={`patient-profile-${patientId}`}
        disabled={disabled}
      />
    </div>
  );
}
