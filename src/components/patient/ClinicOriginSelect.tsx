import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClinicPatientOrigins } from '@/hooks/use-clinic-patient-origins';
import { originNameById } from '@/services/api/clinicPatientOriginsApi';

const NONE_VALUE = '__none__';

type ClinicOriginSelectProps = {
  value: string;
  onChange: (originId: string, originName: string) => void;
  id?: string;
  disabled?: boolean;
};

export function ClinicOriginSelect({
  value,
  onChange,
  id,
  disabled,
}: ClinicOriginSelectProps) {
  const { origins, isLoading } = useClinicPatientOrigins();
  const options = origins.filter((origin) => origin.is_active || origin.id === value);

  return (
    <div className="space-y-1">
      <Select
        value={value || NONE_VALUE}
        onValueChange={(next) => {
          if (next === NONE_VALUE) {
            onChange('', '');
            return;
          }
          onChange(next, originNameById(origins, next));
        }}
        disabled={disabled || isLoading}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={isLoading ? 'Carregando origens…' : 'Selecione a origem'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>Selecione a origem</SelectItem>
          {options.map((origin) => (
            <SelectItem key={origin.id} value={origin.id}>
              {origin.name}
              {!origin.is_active ? ' (inativa)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isLoading && origins.filter((origin) => origin.is_active).length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma origem cadastrada. O master da clínica cadastra em Configurações → Origens.
        </p>
      ) : null}
    </div>
  );
}
