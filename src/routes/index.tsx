import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouteObject, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout, PageLoading } from '@/layouts';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGestaoLayout } from '@/components/admin/AdminGestaoLayout';
import { BlockedUserGuard } from '@/components/admin/BlockedUserGuard';
import { patientsLoader, agendaLoader, dashboardLoader } from './loaders';
import Auth from '@/pages/Auth';

const ADMIN_EMAIL = 'admin@clinievo.com.br';

/** Redireciona "/" para o dashboard correto: admin vai para /admin/dashboard, demais para /dashboard. */
function RootRedirect() {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  return <Navigate to={isAdmin ? '/admin/dashboard' : '/dashboard'} replace />;
}

const Patients = lazy(() => import('@/pages/Patients'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const AuthSignup = lazy(() => import('@/pages/AuthSignup'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const NewPatient = lazy(() => import('@/pages/NewPatient'));
const EditPatient = lazy(() => import('@/pages/EditPatient'));
const PatientDetail = lazy(() => import('@/pages/PatientDetail'));
const Agenda = lazy(() => import('@/pages/Agenda'));
const Settings = lazy(() => import('@/pages/Settings'));
const SettingsProfile = lazy(() => import('@/pages/SettingsProfile'));
const SettingsWhatsApp = lazy(() => import('@/pages/SettingsWhatsApp'));
const SettingsClinicTeam = lazy(() => import('@/pages/SettingsClinicTeam'));
const SettingsClinicBranches = lazy(() => import('@/pages/SettingsClinicBranches'));
const SettingsClinicProcedures = lazy(() => import('@/pages/SettingsClinicProcedures'));
const SettingsClinicOrigins = lazy(() => import('@/pages/SettingsClinicOrigins'));
const SettingsClinicRecordTypes = lazy(() => import('@/pages/SettingsClinicRecordTypes'));
const SettingsSalonProcedures = lazy(() => import('@/pages/SettingsSalonProcedures'));
const ProcedureListPage = lazy(() => import('@/pages/ProcedureListPage'));
const ProcedureStartPage = lazy(() => import('@/pages/ProcedureStartPage'));
const ProcedureInstanceDetailPage = lazy(() => import('@/pages/ProcedureInstanceDetailPage'));
const EmagrecimentoRelatorioPage = lazy(() => import('@/pages/EmagrecimentoRelatorioPage'));
const NewPatientSessionPage = lazy(() => import('@/pages/NewPatientSessionPage'));
const ClinicProcedureAttendancePage = lazy(() => import('@/pages/ClinicProcedureAttendancePage'));
const PatientAnamnesePage = lazy(() => import('@/pages/PatientAnamnesePage'));
const PatientExamsPage = lazy(() => import('@/pages/PatientExamsPage'));
const PatientPrescriptionsPage = lazy(() => import('@/pages/PatientPrescriptionsPage'));
const ConsultationChoosePatientPage = lazy(() => import('@/pages/ConsultationChoosePatientPage'));
const ConsultationSessionPage = lazy(() => import('@/pages/ConsultationSessionPage'));
const Faturamento = lazy(() => import('@/pages/Faturamento'));
const FluxoCaixaPage = lazy(() => import('@/pages/FluxoCaixaPage'));
const EntradasInsumosPage = lazy(() => import('@/pages/EntradasInsumosPage'));
const ProgramaBotox = lazy(() => import('@/pages/ProgramaBotox'));
const Anotacoes = lazy(() => import('@/pages/Anotacoes'));
const CobrancaPage = lazy(() => import('@/pages/CobrancaPage'));
const DepilacaoLaserPage = lazy(() => import('@/pages/DepilacaoLaserPage'));
const DepilacaoLaserStartPage = lazy(() => import('@/pages/DepilacaoLaserStartPage'));
const VerResumoPage = lazy(() => import('@/pages/VerResumoPage'));
const PrescriptionShareRedirectPage = lazy(() => import('@/pages/PrescriptionShareRedirectPage'));
const PublicEmagrecimentoRelatorioPage = lazy(() => import('@/pages/PublicEmagrecimentoRelatorioPage'));
const PublicProcedureReportPage = lazy(() => import('@/pages/PublicProcedureReportPage'));
const PublicOrcamentoPage = lazy(() => import('@/pages/PublicOrcamentoPage'));
const PublicPatientAnamnesePage = lazy(() => import('@/pages/PublicPatientAnamnesePage'));
const PublicPatientRegistrationPage = lazy(() => import('@/pages/PublicPatientRegistrationPage'));
const OrcamentoListPage = lazy(() => import('@/pages/OrcamentoListPage'));
const OrcamentoEditorPage = lazy(() => import('@/pages/OrcamentoEditorPage'));
const OrcamentoEnviarPage = lazy(() => import('@/pages/OrcamentoEnviarPage'));
const ReceituarioModelosPage = lazy(() => import('@/pages/ReceituarioModelosPage'));
const ContaBloqueadaPage = lazy(() => import('@/pages/ContaBloqueadaPage'));
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'));
const AdminNewProfilePage = lazy(() => import('@/pages/AdminNewProfilePage'));
const AdminProcedurePermissionsPage = lazy(() => import('@/pages/AdminProcedurePermissionsPage'));
const AdminProcedureFieldSettingsPage = lazy(() => import('@/pages/AdminProcedureFieldSettingsPage'));
const AdminProcedureEditorPage = lazy(() => import('@/pages/AdminProcedureEditorPage'));
const AdminPatientImportPage = lazy(() => import('@/pages/AdminPatientImportPage'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Atendimento = lazy(() => import('@/pages/Atendimento'));
const BranchOperationalPage = lazy(() => import('@/pages/BranchOperationalPage'));
const BranchOperationalCasePage = lazy(() => import('@/pages/BranchOperationalCasePage'));

const routes: RouteObject[] = [
  // Rota pública no topo: garante match em `/re/:slug` sem depender do join com `path: '/'`.
  {
    path: '/re/:slug',
    element: (
      <>
        <ScrollToTop />
        <PublicEmagrecimentoRelatorioPage />
      </>
    ),
  },
  {
    path: '/rp/:slug',
    element: (
      <>
        <ScrollToTop />
        <PublicProcedureReportPage />
      </>
    ),
  },
  {
    path: '/ro/:slug',
    element: (
      <>
        <ScrollToTop />
        <PublicOrcamentoPage />
      </>
    ),
  },
  {
    path: '/pa/:slug',
    element: (
      <>
        <ScrollToTop />
        <PublicPatientAnamnesePage />
      </>
    ),
  },
  {
    path: '/pc/:slug',
    element: (
      <>
        <ScrollToTop />
        <PublicPatientRegistrationPage />
      </>
    ),
  },
  {
    path: '/',
    element: (
      <>
        <ScrollToTop />
        <Outlet />
      </>
    ),
    children: [
      {
        path: 'institucional',
        element: (
          <Suspense fallback={<PageLoading />}>
            <LandingPage />
          </Suspense>
        ),
      },
      { path: 'auth', element: <Auth /> },
      { path: 'auth/signup', element: <AuthSignup /> },
      { path: 'ver-resumo/:slug', element: <VerResumoPage /> },
      { path: 'r', element: <VerResumoPage /> },
      { path: 'r/:slug', element: <VerResumoPage /> },
      { path: 'rx', element: <PrescriptionShareRedirectPage /> },
      { path: 'conta-bloqueada', element: <ContaBloqueadaPage /> },
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboardPage /> },
          { path: 'users/new', element: <AdminNewProfilePage /> },
          { path: 'users', element: <AdminUsersPage /> },
          {
            path: 'gestao',
            element: <AdminGestaoLayout />,
            children: [
              { index: true, element: <Navigate to="procedures-permissions" replace /> },
              { path: 'procedures-permissions', element: <AdminProcedurePermissionsPage embedded /> },
              { path: 'screen-permissions', element: <AdminProcedureFieldSettingsPage mode="permissions" embedded /> },
              { path: 'procedure-editor', element: <AdminProcedureEditorPage embedded /> },
              { path: 'patient-import', element: <AdminPatientImportPage embedded /> },
            ],
          },
          { path: 'procedures-permissions', element: <Navigate to="/admin/gestao/procedures-permissions" replace /> },
          { path: 'procedure-fields-settings', element: <AdminProcedureFieldSettingsPage mode="modules" /> },
          { path: 'screen-permissions', element: <Navigate to="/admin/gestao/screen-permissions" replace /> },
          { path: 'procedure-editor', element: <Navigate to="/admin/gestao/procedure-editor" replace /> },
          { path: 'patient-import', element: <Navigate to="/admin/gestao/patient-import" replace /> },
          { path: 'procedures', element: <Navigate to="/admin/gestao/procedures-permissions" replace /> },
        ],
      },
      {
        element: (
          <BlockedUserGuard>
            <Outlet />
          </BlockedUserGuard>
        ),
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <RootRedirect /> },
              { path: 'dashboard', element: <Dashboard />, loader: dashboardLoader },
              { path: 'patients', element: <Patients />, loader: patientsLoader },
              { path: 'patients/new', element: <NewPatient /> },
              { path: 'patients/:id/edit', element: <EditPatient /> },
              { path: 'patients/:id', element: <PatientDetail /> },
              { path: 'patients/:id/session/new', element: <NewPatientSessionPage /> },
              { path: 'patients/:id/clinic-attendance/new', element: <ClinicProcedureAttendancePage /> },
              { path: 'patients/:id/clinic-attendance/:sessionId', element: <ClinicProcedureAttendancePage /> },
              { path: 'patients/:id/anamnese', element: <PatientAnamnesePage /> },
              { path: 'patients/:id/exams', element: <PatientExamsPage /> },
              { path: 'patients/:id/prescriptions', element: <PatientPrescriptionsPage /> },
              { path: 'consultation', element: <ConsultationChoosePatientPage /> },
              { path: 'consultation/:patientId', element: <ConsultationSessionPage /> },
              { path: 'agenda', element: <Agenda />, loader: agendaLoader },
              { path: 'faturamento', element: <Faturamento /> },
              { path: 'cobranca', element: <CobrancaPage /> },
              { path: 'fluxo-caixa', element: <FluxoCaixaPage /> },
              { path: 'insumos-nf', element: <EntradasInsumosPage /> },
              { path: 'programa-botox', element: <ProgramaBotox /> },
              { path: 'depilacao-laser', element: <DepilacaoLaserPage /> },
              { path: 'depilacao-laser/start', element: <DepilacaoLaserStartPage /> },
              { path: 'anotacoes', element: <Anotacoes /> },
              { path: 'orcamento', element: <OrcamentoListPage /> },
              { path: 'orcamento/novo', element: <OrcamentoEditorPage /> },
              { path: 'orcamento/enviar/:budgetId', element: <OrcamentoEnviarPage /> },
              { path: 'orcamento/:budgetId', element: <OrcamentoEditorPage /> },
              { path: 'receituario', element: <ReceituarioModelosPage /> },
              { path: 'atendimento', element: <Atendimento /> },
              { path: 'operacional', element: <BranchOperationalPage /> },
              { path: 'operacional/:caseId', element: <BranchOperationalCasePage /> },
              { path: 'settings', element: <Settings /> },
              { path: 'settings/profile', element: <SettingsProfile /> },
              { path: 'settings/whatsapp', element: <SettingsWhatsApp /> },
              { path: 'settings/equipe', element: <SettingsClinicTeam /> },
              { path: 'settings/filiais', element: <SettingsClinicBranches /> },
              { path: 'settings/procedimentos', element: <SettingsClinicProcedures /> },
              { path: 'settings/origens', element: <SettingsClinicOrigins /> },
              { path: 'settings/tipos-ficha', element: <SettingsClinicRecordTypes /> },
              { path: 'settings/procedimentos-salao', element: <SettingsSalonProcedures /> },
              { path: 'procedures/:slug', element: <ProcedureListPage /> },
              { path: 'procedures/:slug/start', element: <ProcedureStartPage /> },
              { path: 'procedures/:slug/:instanceId/relatorio', element: <EmagrecimentoRelatorioPage /> },
              { path: 'procedures/:slug/:instanceId', element: <ProcedureInstanceDetailPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes, {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
});
