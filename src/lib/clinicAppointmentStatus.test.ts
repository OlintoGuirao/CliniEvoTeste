import { describe, expect, it } from 'vitest';
import {
  CLINIC_APPOINTMENT_STATUS_OPTIONS,
  clinicAppointmentStatusLabel,
  clinicStatusFromPresence,
  clinicStatusWritePayload,
  resolveClinicAppointmentStatus,
} from './clinicAppointmentStatus';

describe('clinicAppointmentStatus', () => {
  it('expõe os 11 status da situação', () => {
    expect(CLINIC_APPOINTMENT_STATUS_OPTIONS.map((opt) => opt.label)).toEqual([
      'A confirmar',
      'Confirmado pelo paciente',
      'Confirmado',
      'Em espera',
      'Pagamento',
      'Pré-atendimento',
      'Em andamento',
      'Finalizado',
      'Cancelado pelo profissional',
      'Cancelado pelo paciente',
      'Faltou',
    ]);
  });

  it('resolve status salvo ou cai para presença', () => {
    expect(resolveClinicAppointmentStatus({ clinicStatus: 'waiting' })).toBe('waiting');
    expect(resolveClinicAppointmentStatus({ presenceConfirmedAt: '2026-09-01T12:00:00.000Z' })).toBe(
      'confirmed'
    );
    expect(resolveClinicAppointmentStatus({ presenceDeclinedAt: '2026-09-01T12:00:00.000Z' })).toBe(
      'cancelled_by_patient'
    );
    expect(resolveClinicAppointmentStatus({})).toBe('to_confirm');
    expect(clinicStatusFromPresence(null)).toBe('to_confirm');
    expect(clinicAppointmentStatusLabel('in_progress')).toBe('Em andamento');
  });

  it('sincroniza presença ao gravar o status', () => {
    expect(clinicStatusWritePayload('to_confirm')).toEqual({
      clinic_status: 'to_confirm',
      presence_confirmed_at: null,
      presence_declined_at: null,
    });
    const kept = clinicStatusWritePayload('waiting', {
      presence_confirmed_at: '2026-09-01T12:00:00.000Z',
    });
    expect(kept.clinic_status).toBe('waiting');
    expect(kept.presence_confirmed_at).toBe('2026-09-01T12:00:00.000Z');
    expect(kept.presence_declined_at).toBeNull();
    const missed = clinicStatusWritePayload('no_show');
    expect(missed.presence_confirmed_at).toBeNull();
    expect(missed.presence_declined_at).toEqual(expect.any(String));
  });
});
