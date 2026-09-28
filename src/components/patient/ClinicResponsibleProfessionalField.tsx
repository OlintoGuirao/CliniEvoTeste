import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { fetchClinicAgendaProfessionals } from '@/lib/clinicAgendaBooking';
import { cn } from '@/lib/utils';

type ClinicResponsibleProfessionalFieldProps = {
  value: string;
  onChange: (userId: string) => void;
  /** Inclui o id atual mesmo se não estiver na lista filtrada (ex.: profissional antigo). */
  ensureUserId?: string | null;
  ensureUserName?: string | null;
  disabled?: boolean;
  id?: string;
  className?: string;
  labelClassName?: string;
  /** Quando true, renderiza só o select (sem label). */
  hideLabel?: boolean;
};

type Option = { userId: string; name: string };

/** Select de profissional responsável — exclusivo de conta clínica. */
export function ClinicResponsibleProfessionalField({
  value,
  onChange,
  ensureUserId,
  ensureUserName,
  disabled,
  id = 'clinic-responsible-professional',
  className,
  labelClassName,
  hideLabel,
}: ClinicResponsibleProfessionalFieldProps) {
  const { user, profile } = useAuth();
  const currentUserId = profile?.id ?? user?.id ?? null;
  const selfName = profile?.full_name?.trim() || profile?.email?.trim() || 'Você';

  const professionalsQuery = useQuery({
    queryKey: ['clinic-agenda-professionals-responsible'],
    queryFn: fetchClinicAgendaProfessionals,
    staleTime: 60_000,
  });

  const options = useMemo(() => {
    const byId = new Map<string, Option>();

    for (const p of professionalsQuery.data ?? []) {
      byId.set(p.userId, {
        userId: p.userId,
        name: p.name?.trim() || (p.userId === currentUserId ? selfName : 'Profissional'),
      });
    }

    if (currentUserId && !byId.has(currentUserId)) {
      byId.set(currentUserId, { userId: currentUserId, name: selfName });
    }

    if (ensureUserId && !byId.has(ensureUserId)) {
      byId.set(ensureUserId, {
        userId: ensureUserId,
        name:
          ensureUserName?.trim() ||
          (ensureUserId === currentUserId ? selfName : 'Profissional'),
      });
    }

    // Garante nome do usuário logado mesmo se a RPC trouxe só o id
    if (currentUserId && byId.has(currentUserId)) {
      const cur = byId.get(currentUserId)!;
      if (!cur.name || cur.name === 'Profissional') {
        byId.set(currentUserId, { ...cur, name: selfName });
      }
    }

    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR')
    );
  }, [professionalsQuery.data, ensureUserId, ensureUserName, currentUserId, selfName]);

  useEffect(() => {
    if (disabled || value || options.length === 0) return;
    const next = resolveDefaultClinicResponsibleId({
      options,
      currentUserId,
      patientProfessionalId: ensureUserId,
    });
    if (next) onChange(next);
  }, [disabled, value, options, currentUserId, ensureUserId, onChange]);

  const selectedLabel =
    options.find((o) => o.userId === value)?.name ||
    ensureUserName?.trim() ||
    (value && value === currentUserId ? selfName : null) ||
    '—';

  if (disabled) {
    return (
      <div className={cn('space-y-1.5', className)}>
        {!hideLabel ? (
          <Label htmlFor={id} className={labelClassName}>
            Profissional responsável
          </Label>
        ) : null}
        <div
          id={id}
          className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm"
        >
          {selectedLabel}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {!hideLabel ? (
        <Label htmlFor={id} className={labelClassName}>
          Profissional responsável
        </Label>
      ) : null}
      <Select
        value={value || undefined}
        onValueChange={onChange}
        disabled={professionalsQuery.isLoading || options.length === 0}
      >
        <SelectTrigger id={id} className="rounded-xl">
          <SelectValue
            placeholder={
              professionalsQuery.isLoading ? 'Carregando…' : 'Selecione o profissional'
            }
          >
            {value ? selectedLabel : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.userId} value={o.userId}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function resolveDefaultClinicResponsibleId(params: {
  options: Array<{ userId: string }>;
  currentUserId?: string | null;
  patientProfessionalId?: string | null;
}): string {
  const ids = new Set(params.options.map((o) => o.userId));
  if (params.patientProfessionalId && ids.has(params.patientProfessionalId)) {
    return params.patientProfessionalId;
  }
  if (params.currentUserId && ids.has(params.currentUserId)) {
    return params.currentUserId;
  }
  return params.options[0]?.userId ?? params.currentUserId ?? '';
}
