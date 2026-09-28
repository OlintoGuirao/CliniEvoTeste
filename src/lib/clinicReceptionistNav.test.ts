import { describe, expect, it } from 'vitest';
import {
  filterNavForClinicReceptionist,
  isClinicReceptionistNavPath,
  isClinicReceptionistRouteAllowed,
} from '@/lib/clinicReceptionistNav';

import { isClinicFrontDeskStaffTitle } from '@/lib/clinicTeamRoles';

describe('clinicReceptionistNav', () => {
  it('identifica funções de recepção/atendimento', () => {
    expect(isClinicFrontDeskStaffTitle('recepcionista')).toBe(true);
    expect(isClinicFrontDeskStaffTitle('secretaria')).toBe(true);
    expect(isClinicFrontDeskStaffTitle('atendente')).toBe(true);
    expect(isClinicFrontDeskStaffTitle('contador')).toBe(false);
  });

  it('permite apenas rotas do menu da recepção', () => {
    expect(isClinicReceptionistNavPath('/dashboard')).toBe(true);
    expect(isClinicReceptionistNavPath('/orcamento/novo')).toBe(true);
    expect(isClinicReceptionistNavPath('/operacional/case-1')).toBe(true);
    expect(isClinicReceptionistNavPath('/patients')).toBe(true);
    expect(isClinicReceptionistNavPath('/patients/new')).toBe(true);
    expect(isClinicReceptionistNavPath('/consultation')).toBe(false);
  });

  it('permite meu perfil e secretária whatsapp na rota completa', () => {
    expect(isClinicReceptionistRouteAllowed('/settings/profile')).toBe(true);
    expect(isClinicReceptionistRouteAllowed('/settings/whatsapp')).toBe(true);
    expect(isClinicReceptionistRouteAllowed('/settings')).toBe(false);
  });

  it('filtra itens de navegação para recepção/atendimento', () => {
    const items = [
      { title: 'Início', url: '/dashboard' },
      { title: 'Pacientes', url: '/patients' },
      { title: 'Agenda', url: '/agenda' },
    ];

    const filtered = filterNavForClinicReceptionist(items, true, 'url');
    expect(filtered.map((i) => i.url)).toEqual(['/dashboard', '/patients', '/agenda']);
  });
});
