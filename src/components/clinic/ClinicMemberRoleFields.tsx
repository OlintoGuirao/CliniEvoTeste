import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CLINIC_COUNCILS,
  CLINIC_STAFF_TITLES,
  COUNCIL_SPECIALTY_SUGGESTIONS,
  NO_COUNCIL_VALUE,
  parseMemberCouncilAndStaff,
  professionForCouncil,
  resolveStaffTitleFromStorage,
  suggestSystemRole,
  type ClinicCouncilId,
} from '@/lib/clinicTeamRoles';

/** UFs brasileiras para registro no conselho. */
export const BRAZILIAN_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type ClinicMemberRoleDraft = {
  councilId: string;
  councilOther: string;
  registryNumber: string;
  /** UF do registro (ex.: SP, MS). */
  registryUf: string;
  specialty: string;
  staffTitle: string;
  staffTitleOther: string;
  systemRole: 'professional' | 'attendant';
};

export function parseRegistryNumberAndUf(raw: string | null | undefined): {
  registryNumber: string;
  registryUf: string;
} {
  const value = (raw ?? '').trim();
  if (!value) return { registryNumber: '', registryUf: '' };

  const prefixUf = value.match(/^([A-Za-z]{2})\s*[-–]\s*(.+)$/);
  if (prefixUf && BRAZILIAN_UFS.includes(prefixUf[1].toUpperCase() as (typeof BRAZILIAN_UFS)[number])) {
    return {
      registryUf: prefixUf[1].toUpperCase(),
      registryNumber: prefixUf[2].trim(),
    };
  }

  const suffixUf = value.match(/^(.+?)[-–]\s*([A-Za-z]{2})$/);
  if (suffixUf && BRAZILIAN_UFS.includes(suffixUf[2].toUpperCase() as (typeof BRAZILIAN_UFS)[number])) {
    return {
      registryNumber: suffixUf[1].trim(),
      registryUf: suffixUf[2].toUpperCase(),
    };
  }

  return { registryNumber: value, registryUf: '' };
}

/** Persiste nº + UF no formato número-estado: "123456-GO". */
export function resolveRegistryNumber(draft: ClinicMemberRoleDraft): string | null {
  const number = draft.registryNumber.trim();
  const uf = draft.registryUf.trim().toUpperCase();
  if (!number && !uf) return null;
  if (uf && number) return `${number}-${uf}`;
  return number || uf || null;
}

export function emptyMemberRoleDraft(): ClinicMemberRoleDraft {
  return {
    councilId: NO_COUNCIL_VALUE,
    councilOther: '',
    registryNumber: '',
    registryUf: '',
    specialty: '',
    staffTitle: '',
    staffTitleOther: '',
    systemRole: 'professional',
  };
}

export function memberRoleDraftFromProfile(params: {
  councilBody: string | null | undefined;
  registryNumber: string | null | undefined;
  specialty: string | null | undefined;
  staffTitle: string | null | undefined;
  systemRole: 'professional' | 'attendant';
}): ClinicMemberRoleDraft {
  const parsed = parseMemberCouncilAndStaff(params.councilBody, params.staffTitle);
  const knownCouncil = CLINIC_COUNCILS.some((c) => c.id === parsed.councilBody);
  const councilId = parsed.councilBody
    ? knownCouncil
      ? parsed.councilBody!
      : 'outro'
    : NO_COUNCIL_VALUE;
  const staffResolved = resolveStaffTitleFromStorage(parsed.staffTitle);
  const registry = parseRegistryNumberAndUf(params.registryNumber);

  return {
    councilId,
    councilOther: councilId === 'outro' && parsed.councilBody ? parsed.councilBody : '',
    registryNumber: registry.registryNumber,
    registryUf: registry.registryUf,
    specialty: params.specialty ?? '',
    staffTitle: councilId === NO_COUNCIL_VALUE ? staffResolved.staffTitle : '',
    staffTitleOther: councilId === NO_COUNCIL_VALUE ? staffResolved.staffTitleOther : '',
    systemRole: params.systemRole,
  };
}

export function resolveCouncilBody(draft: ClinicMemberRoleDraft): string | null {
  if (draft.councilId === NO_COUNCIL_VALUE) return null;
  if (draft.councilId === 'outro') return draft.councilOther.trim() || null;
  return draft.councilId;
}

export function resolveStaffTitle(draft: ClinicMemberRoleDraft): string | null {
  if (draft.councilId !== NO_COUNCIL_VALUE) return null;
  if (!draft.staffTitle) return null;
  if (draft.staffTitle === 'outro') return draft.staffTitleOther.trim() || null;
  return draft.staffTitle;
}

type ClinicMemberRoleFieldsProps = {
  draft: ClinicMemberRoleDraft;
  onChange: (patch: Partial<ClinicMemberRoleDraft>) => void;
  idPrefix?: string;
  /** Oculta “Acesso no sistema” (ex.: o próprio profissional editando Meu perfil). */
  hideSystemAccess?: boolean;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

export function ClinicMemberRoleFields({
  draft,
  onChange,
  idPrefix = 'member',
  hideSystemAccess = false,
}: ClinicMemberRoleFieldsProps) {
  const hasCouncil = draft.councilId !== NO_COUNCIL_VALUE;
  const profession = professionForCouncil(draft.councilId);
  const specialtySuggestions =
    COUNCIL_SPECIALTY_SUGGESTIONS[draft.councilId as ClinicCouncilId] ?? [];

  const applyCouncilChange = (councilId: string) => {
    const nextRole = suggestSystemRole({
      councilId,
      staffTitle: councilId === NO_COUNCIL_VALUE ? draft.staffTitle : null,
    });
    onChange({
      councilId,
      councilOther: councilId === 'outro' ? draft.councilOther : '',
      specialty: councilId === NO_COUNCIL_VALUE ? '' : draft.specialty,
      registryNumber: councilId === NO_COUNCIL_VALUE ? '' : draft.registryNumber,
      registryUf: councilId === NO_COUNCIL_VALUE ? '' : draft.registryUf,
      systemRole: nextRole,
    });
  };

  const applyStaffChange = (staffTitle: string) => {
    onChange({
      staffTitle,
      staffTitleOther: staffTitle === 'outro' ? draft.staffTitleOther : '',
      systemRole: suggestSystemRole({ councilId: NO_COUNCIL_VALUE, staffTitle }),
    });
  };

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <SectionTitle>Perfil na clínica</SectionTitle>
        <div className="space-y-1.5">
          <Label>Conselho de classe</Label>
          <Select value={draft.councilId} onValueChange={applyCouncilChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o conselho" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_COUNCIL_VALUE}>Sem conselho — função administrativa</SelectItem>
              {CLINIC_COUNCILS.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasCouncil ? (
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            {profession ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Profissão:</span>
                <Badge variant="secondary" className="font-normal">
                  {profession}
                </Badge>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`${idPrefix}-specialty`}>Especialidade</Label>
                {specialtySuggestions.length > 0 ? (
                  <Select
                    value={draft.specialty || undefined}
                    onValueChange={(v) => onChange({ specialty: v })}
                  >
                    <SelectTrigger id={`${idPrefix}-specialty`}>
                      <SelectValue placeholder="Selecione ou digite abaixo" />
                    </SelectTrigger>
                    <SelectContent>
                      {specialtySuggestions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Input
                  value={draft.specialty}
                  onChange={(e) => onChange({ specialty: e.target.value })}
                  placeholder="Ex.: Dermatologia, Harmonização facial"
                  className={specialtySuggestions.length > 0 ? 'mt-2' : undefined}
                />
              </div>
              {draft.councilId === 'outro' ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`${idPrefix}-council-other`}>Nome do conselho</Label>
                  <Input
                    id={`${idPrefix}-council-other`}
                    value={draft.councilOther}
                    onChange={(e) => onChange({ councilOther: e.target.value })}
                    placeholder="Ex.: CRBM-SP"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-registry`}>Nº registro no conselho</Label>
                <Input
                  id={`${idPrefix}-registry`}
                  value={draft.registryNumber}
                  onChange={(e) => onChange({ registryNumber: e.target.value })}
                  placeholder="Ex.: 123456"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-registry-uf`}>Estado</Label>
                <Select
                  value={draft.registryUf || undefined}
                  onValueChange={(v) => onChange({ registryUf: v })}
                >
                  <SelectTrigger id={`${idPrefix}-registry-uf`}>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_UFS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Função na clínica</Label>
                <Select
                  key={`${idPrefix}-staff-${draft.staffTitle || 'empty'}`}
                  value={draft.staffTitle || undefined}
                  onValueChange={applyStaffChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLINIC_STAFF_TITLES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {draft.staffTitle === 'outro' ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`${idPrefix}-staff-other`}>Descreva a função</Label>
                  <Input
                    id={`${idPrefix}-staff-other`}
                    value={draft.staffTitleOther}
                    onChange={(e) => onChange({ staffTitleOther: e.target.value })}
                    placeholder="Ex.: Coordenador(a) operacional"
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {hideSystemAccess ? null : (
        <>
          <Separator />

          <section className="space-y-2">
            <SectionTitle>Acesso no sistema</SectionTitle>
            <div className="space-y-1.5 max-w-sm">
              <Select
                value={draft.systemRole}
                onValueChange={(v) => onChange({ systemRole: v as 'professional' | 'attendant' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Profissional clínico</SelectItem>
                  <SelectItem value="attendant">Atendente / recepção</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Define permissões operacionais. Sugerido automaticamente conforme conselho ou função.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
