import { describe, expect, it } from 'vitest';
import {
  addMinutesToTime,
  clinicAppointmentPatientName,
  clinicDaySummary,
  clinicNextFreeTimes,
  clinicProcedureAccent,
  clinicTimeRangeLabel,
  isClinicPendingAppointment,
  type ClinicAgendaLayoutAppointment,
} from './clinicAgendaLayout';

function apt(
  partial: Partial<ClinicAgendaLayoutAppointment> & Pick<ClinicAgendaLayoutAppointment, 'id'>
): ClinicAgendaLayoutAppointment {
  return {
    patient_id: 'p1',
    full_name: null,
    notes: null,
    appointment_date: '2026-09-04',
    start_time: '08:00',
    patients: { full_name: 'xunim' },
    ...partial,
  };
}

describe('clinicAgendaLayout', () => {
  it('monta o intervalo do horário', () => {
    expect(addMinutesToTime('08:00', 30)).toBe('08:30');
    expect(clinicTimeRangeLabel('09:00')).toBe('09:00 - 09:30');
  });

  it('escolhe cor do card pelo procedimento', () => {
    expect(clinicProcedureAccent('Botox (Toxina Botulínica)').key).toBe('blue');
    expect(clinicProcedureAccent('Emagrecimento / Redução de Medidas').key).toBe('green');
  });

  it('formata nome do paciente', () => {
    expect(
      clinicAppointmentPatientName(
        apt({ id: '1', patients: { full_name: 'MARIA SILVA' } })
      )
    ).toBe('Maria Silva');
  });

  it('conta resumo do dia e próximos livres', () => {
    const appointments = [
      apt({ id: '1', clinic_status: 'confirmed' }),
      apt({ id: '2', clinic_status: 'to_confirm', start_time: '09:00' }),
      apt({ id: '3', clinic_status: 'cancelled_by_patient', start_time: '10:00' }),
    ];
    const timeSlots = ['08:00', '08:30', '09:00', '09:30', '10:00'];
    const occupied = new Set(['08:00', '09:00', '10:00']);
    const isBookable = (time: string) => !occupied.has(time);

    expect(clinicDaySummary({ appointments, timeSlots, isBookable })).toEqual({
      confirmed: 1,
      pending: 1,
      free: 2,
    });
    expect(clinicNextFreeTimes(timeSlots, isBookable, 5)).toEqual(['08:30', '09:30']);
    expect(isClinicPendingAppointment(appointments[1]!)).toBe(true);
  });
});
