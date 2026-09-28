/** Conselhos de classe e funções administrativas para equipe da clínica. */

export type ClinicCouncilId =
  | 'CRM'
  | 'CRO'
  | 'COREN'
  | 'CRBM'
  | 'CRF'
  | 'CREFITO'
  | 'CRN'
  | 'CRP'
  | 'CRBio'
  | 'CRTR'
  | 'CRFa'
  | 'CREF'
  | 'CREFONO'
  | 'CRMV'
  | 'outro';

export type ClinicStaffTitleId =
  | 'secretaria'
  | 'recepcionista'
  | 'atendente'
  | 'contador'
  | 'gestor_financeiro'
  | 'analista_financeiro'
  | 'gestor_clinica'
  | 'marketing'
  | 'rh'
  | 'estoque_insumos'
  | 'auxiliar_administrativo'
  | 'outro';

export const CLINIC_COUNCILS: Array<{
  id: ClinicCouncilId;
  label: string;
  profession: string;
}> = [
  { id: 'CRM', label: 'CRM — Conselho Regional de Medicina', profession: 'Médico(a)' },
  { id: 'CRO', label: 'CRO — Conselho Regional de Odontologia', profession: 'Dentista' },
  { id: 'COREN', label: 'COREN — Conselho Regional de Enfermagem', profession: 'Enfermeiro(a)' },
  { id: 'CRBM', label: 'CRBM — Conselho Regional de Biomedicina', profession: 'Biomédico(a)' },
  { id: 'CRF', label: 'CRF — Conselho Regional de Farmácia', profession: 'Farmacêutico(a)' },
  { id: 'CREFITO', label: 'CREFITO — Fisioterapia e Terapia Ocupacional', profession: 'Fisioterapeuta' },
  { id: 'CRN', label: 'CRN — Conselho Regional de Nutrição', profession: 'Nutricionista' },
  { id: 'CRP', label: 'CRP — Conselho Regional de Psicologia', profession: 'Psicólogo(a)' },
  { id: 'CRBio', label: 'CRBio — Conselho Regional de Biologia', profession: 'Biólogo(a)' },
  { id: 'CRTR', label: 'CRTR — Técnicos em Radiologia', profession: 'Técnico(a) em Radiologia' },
  { id: 'CRFa', label: 'CRFa — Fonoaudiologia', profession: 'Fonoaudiólogo(a)' },
  { id: 'CREF', label: 'CREF — Educação Física', profession: 'Profissional de Educação Física' },
  { id: 'CREFONO', label: 'CREFONO — Fonoaudiologia (legado)', profession: 'Fonoaudiólogo(a)' },
  { id: 'CRMV', label: 'CRMV — Medicina Veterinária', profession: 'Médico(a) Veterinário(a)' },
  { id: 'outro', label: 'Outro conselho', profession: 'Profissional de saúde' },
];

export const CLINIC_STAFF_TITLES: Array<{ id: ClinicStaffTitleId; label: string }> = [
  { id: 'secretaria', label: 'Secretária' },
  { id: 'recepcionista', label: 'Recepcionista' },
  { id: 'atendente', label: 'Atendente' },
  { id: 'contador', label: 'Contador(a)' },
  { id: 'gestor_financeiro', label: 'Gestor(a) financeiro(a)' },
  { id: 'analista_financeiro', label: 'Analista financeiro(a)' },
  { id: 'gestor_clinica', label: 'Gestor(a) da clínica' },
  { id: 'marketing', label: 'Marketing / Comunicação' },
  { id: 'rh', label: 'Recursos humanos' },
  { id: 'estoque_insumos', label: 'Estoque / Insumos' },
  { id: 'auxiliar_administrativo', label: 'Auxiliar administrativo(a)' },
  { id: 'outro', label: 'Outra função' },
];

/** Especialidades sugeridas por conselho (estética / clínica). */
export const COUNCIL_SPECIALTY_SUGGESTIONS: Partial<Record<ClinicCouncilId, string[]>> = {
  CRM: [
    'Dermatologia',
    'Cirurgia plástica',
    'Medicina estética',
    'Endocrinologia',
    'Ginecologia',
    'Clínica geral',
  ],
  CRO: [
    'Clínico geral',
    'Dentista',
    'Implantodontista',
    'Endodontista',
    'Periodontista',
    'Protesista',
    'Bucomaxilo',
    'Harmonização Orofacial',
    'Ortodontia',
    'Estética dental',
  ],
  COREN: ['Estética', 'Enfermagem estética', 'Procedimentos injetáveis', 'Laser'],
  CRBM: [
    'Biomedicina estética',
    'Harmonização facial',
    'Laser',
    'Peeling químico',
    'Microagulhamento',
  ],
  CRF: ['Farmácia estética', 'Manipulação', 'Cosmetologia'],
  CREFITO: ['Fisioterapia dermatofuncional', 'Drenagem linfática', 'Estética corporal'],
  CRN: ['Nutrição estética', 'Emagrecimento', 'Nutrição clínica'],
  CRP: ['Psicologia clínica', 'Saúde mental'],
};

export const NO_COUNCIL_VALUE = '__none__';

/** Espelho da função administrativa em profiles.professional_registry_body (fallback de leitura). */
export const STAFF_REGISTRY_PREFIX = '__STAFF__:';

export function encodeStaffRegistryBody(staffTitle: string | null | undefined): string | null {
  const id = staffTitle?.trim();
  if (!id) return null;
  return `${STAFF_REGISTRY_PREFIX}${id}`;
}

export function parseMemberCouncilAndStaff(
  councilBody: string | null | undefined,
  staffTitle: string | null | undefined
): { councilBody: string | null; staffTitle: string | null } {
  const body = councilBody?.trim() || null;
  if (body?.startsWith(STAFF_REGISTRY_PREFIX)) {
    const fromBody = body.slice(STAFF_REGISTRY_PREFIX.length).trim() || null;
    return {
      councilBody: null,
      staffTitle: staffTitle?.trim() || fromBody,
    };
  }
  return {
    councilBody: body,
    staffTitle: staffTitle?.trim() || null,
  };
}

export function resolveProfileRegistryBody(
  councilBody: string | null | undefined,
  staffTitle: string | null | undefined
): string | null {
  const council = councilBody?.trim() || null;
  if (council) return council;
  return encodeStaffRegistryBody(staffTitle);
}

export function isClinicalCouncilBody(councilBody: string | null | undefined): boolean {
  const body = councilBody?.trim();
  return Boolean(body && !body.startsWith(STAFF_REGISTRY_PREFIX));
}

export function councilById(id: string | null | undefined) {
  return CLINIC_COUNCILS.find((c) => c.id === id);
}

export function staffTitleById(id: string | null | undefined) {
  return CLINIC_STAFF_TITLES.find((s) => s.id === id);
}

/** Converte valor salvo (id, rótulo ou texto livre) para o draft do formulário. */
export function resolveStaffTitleFromStorage(raw: string | null | undefined): {
  staffTitle: string;
  staffTitleOther: string;
} {
  const value = raw?.trim();
  if (!value) return { staffTitle: '', staffTitleOther: '' };

  const byId = CLINIC_STAFF_TITLES.find((s) => s.id === value);
  if (byId) return { staffTitle: byId.id, staffTitleOther: '' };

  const normalized = value.toLowerCase();
  const byLabel = CLINIC_STAFF_TITLES.find(
    (s) => s.label.toLowerCase() === normalized || s.id.toLowerCase() === normalized
  );
  if (byLabel) return { staffTitle: byLabel.id, staffTitleOther: '' };

  return { staffTitle: 'outro', staffTitleOther: value };
}

export function professionForCouncil(councilId: string | null | undefined): string | null {
  if (!councilId || councilId === NO_COUNCIL_VALUE) return null;
  return councilById(councilId)?.profession ?? null;
}

/** Extrai o id da função administrativa salva no perfil (__STAFF__:id). */
export function resolveStaffTitleIdFromProfile(
  profile: { professional_registry_body?: string | null } | null | undefined
): string | null {
  if (!profile) return null;
  const parsed = parseMemberCouncilAndStaff(profile.professional_registry_body, null);
  const resolved = resolveStaffTitleFromStorage(parsed.staffTitle);
  return resolved.staffTitle || null;
}

/** Funções da equipe da clínica com menu operacional restrito (recepção/atendimento). */
export const CLINIC_FRONT_DESK_STAFF_TITLES = ['secretaria', 'recepcionista', 'atendente'] as const;

export type ClinicFrontDeskStaffTitleId = (typeof CLINIC_FRONT_DESK_STAFF_TITLES)[number];

export function isClinicFrontDeskStaffTitle(staffTitleId: string | null | undefined): boolean {
  if (!staffTitleId) return false;
  return (CLINIC_FRONT_DESK_STAFF_TITLES as readonly string[]).includes(staffTitleId);
}

/** @deprecated Prefer isClinicFrontDeskStaffTitle */
export function isClinicReceptionistStaffTitle(staffTitleId: string | null | undefined): boolean {
  return isClinicFrontDeskStaffTitle(staffTitleId);
}

/** Papel operacional sugerido (professional = clínico; attendant = recepção/atendimento). */
export function suggestSystemRole(params: {
  councilId: string | null;
  staffTitle: string | null;
}): 'professional' | 'attendant' {
  if (params.councilId && params.councilId !== NO_COUNCIL_VALUE) return 'professional';
  const staff = params.staffTitle;
  if (staff === 'secretaria' || staff === 'recepcionista' || staff === 'atendente') {
    return 'attendant';
  }
  return 'professional';
}

export function memberDisplayRole(params: {
  role: 'owner' | 'professional' | 'attendant';
  councilBody: string | null | undefined;
  specialty: string | null | undefined;
  staffTitle: string | null | undefined;
}): string {
  if (params.role === 'owner') return 'Master';
  const parsed = parseMemberCouncilAndStaff(params.councilBody, params.staffTitle);
  const council = councilById(parsed.councilBody);
  if (council && parsed.councilBody) {
    const base = council.profession;
    return params.specialty?.trim() ? `${base} · ${params.specialty.trim()}` : base;
  }
  const staffResolved = resolveStaffTitleFromStorage(parsed.staffTitle);
  if (staffResolved.staffTitle === 'outro' && staffResolved.staffTitleOther) {
    return staffResolved.staffTitleOther;
  }
  const staff = staffTitleById(staffResolved.staffTitle);
  if (staff) return staff.label;
  if (params.role === 'attendant') return 'Atendente';
  return 'Profissional';
}
