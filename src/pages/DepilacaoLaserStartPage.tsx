import ConsultationChoosePatientPage from '@/pages/ConsultationChoosePatientPage';

/** Escolha de paciente → consulta com formulário de sessão de Depilação a Laser. */
export default function DepilacaoLaserStartPage() {
  return (
    <ConsultationChoosePatientPage
      procedureSlug="depilacao-laser"
      returnTo="/depilacao-laser"
      backPath="/depilacao-laser"
      title="Nova depilação a laser"
      description="Busque o paciente e registre a sessão com os dados do procedimento"
      breadcrumbLabel="Depilação a laser"
    />
  );
}
