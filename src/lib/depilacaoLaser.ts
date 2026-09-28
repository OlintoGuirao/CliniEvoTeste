import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';

export type LaserUnavailableReason = 'aluguel' | 'manutencao' | 'outro';

export type LaserEquipment = {
  id: string;
  professional_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LaserUnavailablePeriod = {
  id: string;
  professional_id: string;
  equipment_id: string;
  start_date: string;
  end_date: string;
  reason: LaserUnavailableReason;
  note: string | null;
  created_at: string;
  updated_at: string;
  equipment_name?: string;
};

export type LaserTreatmentInstance = {
  id: string;
  patient_id: string;
  patient_name: string;
  data_inicio: string;
  status: string;
  sessions_count: number;
};

const EQUIP_TABLE = 'laser_equipments';
const PERIOD_TABLE = 'laser_equipment_unavailable_periods';

function sb() {
  return supabase as unknown as { from: (t: string) => any };
}

export const LASER_REASON_LABELS: Record<LaserUnavailableReason, string> = {
  aluguel: 'Alugada',
  manutencao: 'Manutenção',
  outro: 'Indisponível',
};

export function laserBlockLabel(period: Pick<LaserUnavailablePeriod, 'reason' | 'note' | 'equipment_name'>): string {
  const reason = LASER_REASON_LABELS[period.reason] || 'Indisponível';
  const equip = period.equipment_name?.trim();
  const base = equip ? `Laser: ${equip} (${reason})` : `Máquina laser (${reason})`;
  const note = period.note?.trim();
  return note ? `${base} — ${note}` : base;
}

export function getLaserBlockForDay(
  day: Date,
  periods: LaserUnavailablePeriod[]
): LaserUnavailablePeriod | null {
  if (!periods.length) return null;
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  for (const period of periods) {
    const start = parseISO(period.start_date);
    const end = parseISO(period.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (d.getTime() >= start.getTime() && d.getTime() <= end.getTime()) return period;
  }
  return null;
}

export function isLaserBlockedDay(day: Date, periods: LaserUnavailablePeriod[]): boolean {
  return !!getLaserBlockForDay(day, periods);
}

export async function fetchLaserEquipments(professionalId: string): Promise<LaserEquipment[]> {
  const { data, error } = await sb()
    .from(EQUIP_TABLE)
    .select('id, professional_id, name, brand, model, serial_number, notes, is_active, created_at, updated_at')
    .eq('professional_id', professionalId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LaserEquipment[];
}

export async function createLaserEquipment(params: {
  professionalId: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  notes?: string;
}): Promise<LaserEquipment> {
  const name = params.name.trim();
  if (!name) throw new Error('Nome da máquina obrigatório');
  const { data, error } = await sb()
    .from(EQUIP_TABLE)
    .insert({
      professional_id: params.professionalId,
      name,
      brand: params.brand?.trim() || null,
      model: params.model?.trim() || null,
      serial_number: params.serialNumber?.trim() || null,
      notes: params.notes?.trim() || null,
    })
    .select('id, professional_id, name, brand, model, serial_number, notes, is_active, created_at, updated_at')
    .single();
  if (error) throw error;
  return data as LaserEquipment;
}

export async function updateLaserEquipment(
  id: string,
  params: {
    name?: string;
    brand?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }
): Promise<LaserEquipment> {
  const payload: Record<string, unknown> = {};
  if (params.name !== undefined) {
    const name = params.name.trim();
    if (!name) throw new Error('Nome da máquina obrigatório');
    payload.name = name;
  }
  if (params.brand !== undefined) payload.brand = params.brand?.trim() || null;
  if (params.model !== undefined) payload.model = params.model?.trim() || null;
  if (params.serialNumber !== undefined) payload.serial_number = params.serialNumber?.trim() || null;
  if (params.notes !== undefined) payload.notes = params.notes?.trim() || null;
  if (params.isActive !== undefined) payload.is_active = params.isActive;

  const { data, error } = await sb()
    .from(EQUIP_TABLE)
    .update(payload)
    .eq('id', id)
    .select('id, professional_id, name, brand, model, serial_number, notes, is_active, created_at, updated_at')
    .single();
  if (error) throw error;
  return data as LaserEquipment;
}

export async function deleteLaserEquipment(id: string): Promise<void> {
  const { error } = await sb().from(EQUIP_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function fetchLaserUnavailablePeriods(professionalId: string): Promise<LaserUnavailablePeriod[]> {
  const { data, error } = await sb()
    .from(PERIOD_TABLE)
    .select(
      'id, professional_id, equipment_id, start_date, end_date, reason, note, created_at, updated_at, laser_equipments(name)'
    )
    .eq('professional_id', professionalId)
    .order('start_date', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as Array<LaserUnavailablePeriod & { laser_equipments?: { name?: string } | null }>).map(
    (row) => ({
      ...row,
      equipment_name: row.laser_equipments?.name ?? undefined,
      laser_equipments: undefined,
    })
  );
}

export async function createLaserUnavailablePeriod(params: {
  professionalId: string;
  equipmentId: string;
  startDate: string;
  endDate: string;
  reason: LaserUnavailableReason;
  note?: string;
}): Promise<LaserUnavailablePeriod> {
  if (!params.equipmentId) throw new Error('Selecione a máquina');
  if (!params.startDate || !params.endDate) throw new Error('Informe o período');
  if (params.endDate < params.startDate) throw new Error('Data final deve ser >= data inicial');

  const { data, error } = await sb()
    .from(PERIOD_TABLE)
    .insert({
      professional_id: params.professionalId,
      equipment_id: params.equipmentId,
      start_date: params.startDate,
      end_date: params.endDate,
      reason: params.reason,
      note: params.note?.trim() || null,
    })
    .select('id, professional_id, equipment_id, start_date, end_date, reason, note, created_at, updated_at')
    .single();
  if (error) throw error;
  return data as LaserUnavailablePeriod;
}

export async function deleteLaserUnavailablePeriod(id: string): Promise<void> {
  const { error } = await sb().from(PERIOD_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function fetchLaserTreatments(professionalId: string): Promise<LaserTreatmentInstance[]> {
  const { data: procedure, error: procError } = await sb()
    .from('procedures')
    .select('id')
    .eq('slug', 'depilacao-laser')
    .eq('is_global', true)
    .maybeSingle();
  if (procError) throw procError;
  if (!procedure?.id) return [];

  const { data, error } = await sb()
    .from('procedure_instances')
    .select('id, patient_id, data_inicio, status, patients(full_name), procedure_sessions(id)')
    .eq('professional_id', professionalId)
    .eq('procedure_id', procedure.id)
    .order('data_inicio', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as Array<{
    id: string;
    patient_id: string;
    data_inicio: string;
    status: string;
    patients?: { full_name?: string } | null;
    procedure_sessions?: Array<{ id: string }> | null;
  }>).map((row) => ({
    id: row.id,
    patient_id: row.patient_id,
    patient_name: row.patients?.full_name || 'Paciente',
    data_inicio: row.data_inicio,
    status: row.status,
    sessions_count: Array.isArray(row.procedure_sessions) ? row.procedure_sessions.length : 0,
  }));
}

export function formatLaserPeriodRange(startDate: string, endDate: string): string {
  try {
    const start = format(parseISO(startDate), 'dd/MM/yyyy');
    const end = format(parseISO(endDate), 'dd/MM/yyyy');
    return start === end ? start : `${start} → ${end}`;
  } catch {
    return `${startDate} → ${endDate}`;
  }
}

export async function ensureDepilacaoLaserProcedureAvailable(
  professionalId: string
): Promise<{ ok: boolean; procedureId?: string; error?: string }> {
  const procs = await getProceduresForProfile(professionalId);
  const found = procs.find((p) => p.slug === 'depilacao-laser');
  if (found) return { ok: true, procedureId: found.id };

  const { data: procedure, error } = await sb()
    .from('procedures')
    .select('id, name, is_active')
    .eq('slug', 'depilacao-laser')
    .eq('is_global', true)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!procedure?.id) {
    return {
      ok: false,
      error: 'Procedimento Depilação a Laser ainda não existe no banco. Rode as migrations.',
    };
  }
  if (!procedure.is_active) {
    return { ok: false, error: 'Procedimento Depilação a Laser está inativo.' };
  }

  return {
    ok: false,
    procedureId: procedure.id,
    error:
      'O procedimento existe, mas este profissional não tem permissão. No admin, marque Depilação a Laser nas permissões do perfil (ou rode a migration 20260714130000).',
  };
}
