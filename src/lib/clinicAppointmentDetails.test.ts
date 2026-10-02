import { describe, expect, it } from 'vitest';
import {
  clinicProcedureLabelFromNotes,
  formatClinicAppointmentCode,
  formatPatientBirthLabel,
  isClinicAvaliacaoAppointment,
  stripClinicAppointmentMetadataFromNotes,
} from './clinicAppointmentDetails';

describe('clinicAppointmentDetails', () => {
  it('gera um código numérico a partir do UUID', () => {
    expect(formatClinicAppointmentCode('11111111-2222-3333-4444-555555555555')).toBe('1431655765');
  });

  it('lê o procedimento e oculta metadados técnicos das observações', () => {
    const notes = [
      'Procedimento: Botox (Toxina Botulínica)',
      'procedure_context:botox',
      'Retorno em 4 meses',
    ].join('\n');
    expect(clinicProcedureLabelFromNotes(notes)).toBe('Botox (Toxina Botulínica)');
    expect(stripClinicAppointmentMetadataFromNotes(notes)).toBe('Retorno em 4 meses');
  });

  it('reconhece agendamento de avaliação', () => {
    expect(isClinicAvaliacaoAppointment('Procedimento: Avaliação\nAvaliação Digital')).toBe(true);
    expect(isClinicAvaliacaoAppointment('Procedimento: Tratamento')).toBe(false);
    expect(isClinicAvaliacaoAppointment(null)).toBe(false);
  });

  it('formata nascimento com idade', () => {
    expect(formatPatientBirthLabel('1980-05-21', new Date(2026, 8, 4))).toBe('21/05/1980 (46 anos)');
    expect(formatPatientBirthLabel(null)).toBeNull();
  });
});
