import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatPatientDisplayName, patientMatchesSearch } from '@/lib/patientDisplay';
import { supabase } from '@/integrations/supabase/client';

export type ClinicReferralPatient = {
  id: string;
  full_name: string;
  nickname?: string | null;
  phone: string | null;
};

async function fetchClinicReferralPatients(): Promise<ClinicReferralPatient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, nickname, phone')
    .eq('is_active', true)
    .order('full_name')
    .limit(500);
  if (error) throw error;
  return (data ?? []) as ClinicReferralPatient[];
}

type ClinicReferredByFieldProps = {
  name: string;
  patientId: string;
  onChange: (next: { name: string; patientId: string }) => void;
  excludePatientId?: string;
  id?: string;
  disabled?: boolean;
};

export function ClinicReferredByField({
  name,
  patientId,
  onChange,
  excludePatientId,
  id,
  disabled,
}: ClinicReferredByFieldProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const patientsQuery = useQuery({
    queryKey: ['clinic-referral-patients'],
    queryFn: fetchClinicReferralPatients,
  });

  const patients = useMemo(
    () =>
      (patientsQuery.data ?? []).filter((patient) => patient.id !== excludePatientId),
    [patientsQuery.data, excludePatientId]
  );

  const suggestions = useMemo(() => {
    const query = name.trim();
    const matches = query
      ? patients.filter((patient) => patientMatchesSearch(patient, query))
      : patients;
    return matches.slice(0, 8);
  }, [patients, name]);

  const selectedPatient = patients.find((patient) => patient.id === patientId) ?? null;
  const typedNameIsCustom =
    Boolean(name.trim()) &&
    (!selectedPatient ||
      formatPatientDisplayName(selectedPatient.full_name, selectedPatient.nickname) !== name.trim());

  useEffect(() => {
    setHighlighted(0);
  }, [name]);

  function selectPatient(patient: ClinicReferralPatient) {
    onChange({
      name: formatPatientDisplayName(patient.full_name, patient.nickname),
      patientId: patient.id,
    });
    setOpen(false);
  }

  function useTypedName() {
    onChange({ name: name.trim(), patientId: '' });
    setOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={name}
          disabled={disabled}
          placeholder="Busque um paciente ou digite o nome"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => {
            const nextName = e.target.value;
            const stillSamePatient =
              selectedPatient &&
              formatPatientDisplayName(selectedPatient.full_name, selectedPatient.nickname) ===
                nextName.trim();
            onChange({
              name: nextName,
              patientId: stillSamePatient ? selectedPatient.id : '',
            });
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (!open) return;
            const customOption = typedNameIsCustom ? 1 : 0;
            const total = suggestions.length + customOption;
            if (total === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlighted((current) => Math.min(current + 1, total - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlighted((current) => Math.max(current - 1, 0));
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (typedNameIsCustom && highlighted === 0) {
                useTypedName();
                return;
              }
              const patientIndex = typedNameIsCustom ? highlighted - 1 : highlighted;
              const patient = suggestions[patientIndex];
              if (patient) selectPatient(patient);
            }
            if (e.key === 'Escape') setOpen(false);
          }}
        />

        {open && !disabled ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {patientsQuery.isLoading ? (
              <li className="px-2 py-2 text-sm text-muted-foreground">Carregando pacientes…</li>
            ) : (
              <>
                {typedNameIsCustom ? (
                  <li
                    role="option"
                    aria-selected={highlighted === 0}
                    className={cn(
                      'cursor-pointer rounded-sm px-2 py-1.5 text-sm',
                      highlighted === 0 && 'bg-accent text-accent-foreground'
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlighted(0)}
                    onClick={useTypedName}
                  >
                    Usar “{name.trim()}” (não é paciente da clínica)
                  </li>
                ) : null}
                {suggestions.map((patient, index) => {
                  const optionIndex = (typedNameIsCustom ? 1 : 0) + index;
                  return (
                    <li
                      key={patient.id}
                      role="option"
                      aria-selected={highlighted === optionIndex}
                      className={cn(
                        'cursor-pointer rounded-sm px-2 py-1.5 text-sm',
                        highlighted === optionIndex && 'bg-accent text-accent-foreground'
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlighted(optionIndex)}
                      onClick={() => selectPatient(patient)}
                    >
                      {formatPatientDisplayName(patient.full_name, patient.nickname)}
                    </li>
                  );
                })}
                {!typedNameIsCustom && suggestions.length === 0 ? (
                  <li className="px-2 py-2 text-sm text-muted-foreground">
                    {name.trim()
                      ? 'Nenhum paciente encontrado. Digite o nome de quem indicou.'
                      : 'Digite para filtrar os pacientes da clínica.'}
                  </li>
                ) : null}
              </>
            )}
          </ul>
        ) : null}
      </div>

      {selectedPatient && !typedNameIsCustom ? (
        <Badge variant="secondary" className="font-normal">
          Paciente da clínica
        </Badge>
      ) : name.trim() ? (
        <p className="text-xs text-muted-foreground">Nome livre — não vinculado a um paciente.</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Opcional. Pode ser um paciente da clínica ou alguém de fora (amigo, familiar…).
        </p>
      )}
    </div>
  );
}
