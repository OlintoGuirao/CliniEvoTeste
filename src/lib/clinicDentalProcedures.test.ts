import { describe, expect, it } from 'vitest';
import { isClinicDentalCatalogProcedure } from './clinicDentalProcedures';

describe('isClinicDentalCatalogProcedure', () => {
  it('identifica category ODONTOLOGIA e slug odontologia-*', () => {
    expect(
      isClinicDentalCatalogProcedure({
        category: 'ODONTOLOGIA',
        specialty: 'Dentística',
        slug: 'odontologia-restauracao-rc-foto-i',
      })
    ).toBe(true);
    expect(
      isClinicDentalCatalogProcedure({
        category: 'Estético',
        specialty: 'estetico',
        slug: 'botox',
      })
    ).toBe(false);
  });

  it('identifica specialty odontologico legado', () => {
    expect(
      isClinicDentalCatalogProcedure({
        category: 'Outros',
        specialty: 'odontologico',
        slug: 'algo',
      })
    ).toBe(true);
  });
});
