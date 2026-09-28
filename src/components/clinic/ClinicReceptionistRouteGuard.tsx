import { Navigate, useLocation } from 'react-router-dom';
import { PageLoading } from '@/components/layout/PageLoading';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import { isClinicReceptionistRouteAllowed } from '@/lib/clinicReceptionistNav';
import { isClinicProfessionalRouteAllowed } from '@/lib/clinicProfessionalNav';

/** Restringe rotas da recepção e do profissional clínico da clínica. */
export function ClinicReceptionistRouteGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isFrontDeskStaff, isClinicClinicalProfessional, isLoading } = useClinicMemberRole();

  if (isLoading) return <PageLoading />;
  if (isFrontDeskStaff && !isClinicReceptionistRouteAllowed(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (isClinicClinicalProfessional && !isClinicProfessionalRouteAllowed(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
