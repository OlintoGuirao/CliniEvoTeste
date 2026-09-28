import { Link, useLocation, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentPatient } from '@/contexts/CurrentPatientContext';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import { useUiCopy } from '@/hooks/use-ui-copy';

/** FAB: na ficha do paciente ou na tela de procedimento = "Nova sessão"; senão = "Nova consulta". Oculto em qualquer tela de consulta (/consultation ou /consultation/:id). */
export function MobileFAB() {
  const location = useLocation();
  const params = useParams();
  const { patientId: contextPatientId } = useCurrentPatient();
  const { isMaster: isClinicMaster } = useClinicMaster();
  const { isFrontDeskStaff, isClinicClinicalProfessional } = useClinicMemberRole();
  const copy = useUiCopy();

  if (isClinicMaster || isFrontDeskStaff || isClinicClinicalProfessional) return null;
  if (location.pathname.startsWith('/consultation')) return null;
  // Formulários longos: FAB cobria Cancelar/Salvar no tablet.
  if (location.pathname === '/patients/new' || /\/patients\/[^/]+\/edit\/?$/.test(location.pathname)) {
    return null;
  }
  if (location.pathname.startsWith('/settings')) return null;
  if (location.pathname.startsWith('/programa-botox') || location.pathname.startsWith('/anotacoes') || location.pathname.startsWith('/insumos-nf') || location.pathname.startsWith('/atendimento')) return null;

  const isOnPatientFicha =
    location.pathname.startsWith('/patients/') &&
    !location.pathname.endsWith('/edit') &&
    !location.pathname.endsWith('/anamnese') &&
    !location.pathname.includes('/session/') &&
    params.id &&
    params.id !== 'new';

  const isOnProcedures = location.pathname.startsWith('/procedures/');

  const patientIdForConsult = isOnPatientFicha ? params.id! : isOnProcedures && contextPatientId ? contextPatientId : null;
  const href = patientIdForConsult ? `/consultation/${patientIdForConsult}` : '/consultation';
  const ariaLabel = patientIdForConsult ? 'Nova sessão' : copy.newConsultation;

  return (
    <Link
      to={href}
      className={cn(
        'nav:hidden fixed z-[1150] flex items-center justify-center rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform',
        'w-14 h-14 min-w-[44px] min-h-[44px] bottom-[calc(var(--mobile-bottom-nav-height)+env(safe-area-inset-bottom)+8px)] right-4'
      )}
      aria-label={ariaLabel}
    >
      <Plus className="w-7 h-7" strokeWidth={2.5} />
    </Link>
  );
}
