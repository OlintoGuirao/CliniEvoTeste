import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLoading } from '@/components/layout/PageLoading';

/** Redireciona para a ficha do paciente na aba Receituário (rota legada). */
export default function PatientPrescriptionsPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (patientId) {
      navigate(`/patients/${patientId}?tab=receituario`, { replace: true });
    } else {
      navigate('/patients', { replace: true });
    }
  }, [patientId, navigate]);

  return <PageLoading />;
}
