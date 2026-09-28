import { Checkbox } from '@/components/ui/checkbox';
import { useClinicRecordTypes } from '@/hooks/use-clinic-record-types';

type ClinicRecordTypeFieldsProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export function ClinicRecordTypeFields({
  selectedIds,
  onChange,
  disabled,
}: ClinicRecordTypeFieldsProps) {
  const { recordTypes, isLoading } = useClinicRecordTypes();
  const options = recordTypes.filter((type) => type.is_active || selectedIds.includes(type.id));

  function toggle(id: string, checked: boolean) {
    if (checked) {
      onChange(selectedIds.includes(id) ? selectedIds : [...selectedIds, id]);
      return;
    }
    onChange(selectedIds.filter((current) => current !== id));
  }

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Carregando tipos de ficha…</p>;
  }

  if (options.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhum tipo cadastrado. O master da clínica cadastra em Configurações → Tipos de ficha.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((type) => {
        const checked = selectedIds.includes(type.id);
        return (
          <label
            key={type.id}
            className="flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm cursor-pointer"
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(next) => toggle(type.id, next === true)}
            />
            <span>
              {type.name}
              {!type.is_active ? ' (inativo)' : ''}
            </span>
          </label>
        );
      })}
    </div>
  );
}
