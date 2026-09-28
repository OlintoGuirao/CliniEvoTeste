import { describe, expect, it } from 'vitest';
import {
  filterNavForClinicProfessional,
  isClinicProfessionalNavPath,
  isClinicProfessionalRouteAllowed,
  isClinicProfessionalSettingsPath,
} from './clinicProfessionalNav';

describe('clinicProfessionalNav', () => {
  it('permite agenda e pacientes no menu', () => {
    expect(isClinicProfessionalNavPath('/dashboard')).toBe(true);
    expect(isClinicProfessionalNavPath('/agenda')).toBe(true);
    expect(isClinicProfessionalNavPath('/patients')).toBe(true);
    expect(isClinicProfessionalNavPath('/patients/abc')).toBe(true);
  });

  it('oculta itens financeiros, whatsapp e nova consulta no menu', () => {
    expect(isClinicProfessionalNavPath('/consultation')).toBe(false);
    expect(isClinicProfessionalNavPath('/faturamento')).toBe(false);
    expect(isClinicProfessionalNavPath('/cobranca')).toBe(false);
    expect(isClinicProfessionalNavPath('/fluxo-caixa')).toBe(false);
    expect(isClinicProfessionalNavPath('/insumos-nf')).toBe(false);
    expect(isClinicProfessionalNavPath('/programa-botox')).toBe(false);
    expect(isClinicProfessionalNavPath('/depilacao-laser')).toBe(false);
    expect(isClinicProfessionalNavPath('/atendimento')).toBe(false);
    expect(isClinicProfessionalNavPath('/settings/whatsapp')).toBe(false);
  });

  it('bloqueia novo paciente e módulos financeiros na rota', () => {
    expect(isClinicProfessionalRouteAllowed('/patients/new')).toBe(false);
    expect(isClinicProfessionalRouteAllowed('/faturamento')).toBe(false);
    expect(isClinicProfessionalRouteAllowed('/consultation/xyz')).toBe(true);
    expect(isClinicProfessionalSettingsPath('/settings/profile')).toBe(true);
    expect(isClinicProfessionalSettingsPath('/settings/whatsapp')).toBe(false);
  });

  it('filtra itens do menu só para profissional clínico', () => {
    const items = [
      { url: '/dashboard' },
      { url: '/consultation' },
      { url: '/agenda' },
      { url: '/faturamento' },
    ];
    expect(filterNavForClinicProfessional(items, false)).toHaveLength(4);
    expect(filterNavForClinicProfessional(items, true).map((i) => i.url)).toEqual([
      '/dashboard',
      '/agenda',
    ]);
  });
});
