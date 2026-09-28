import { useQuery } from '@tanstack/react-query';
import { appointmentsKey } from '@/api/queryKeys';
import { fetchAppointments, type AppointmentRow } from '@/api/appointments';

export type { AppointmentRow };

/**
 * Appointments for a professional in a date range.
 * Use for Agenda week view so data is cached by range.
 */
export function useAppointments(
  professionalId: string | undefined,
  startDate: string,
  endDate: string,
  enabled = true
) {
  return useQuery({
    queryKey: appointmentsKey(professionalId ?? '', startDate, endDate),
    queryFn: () => fetchAppointments(professionalId!, startDate, endDate),
    enabled: !!professionalId && !!startDate && !!endDate && enabled,
  });
}
