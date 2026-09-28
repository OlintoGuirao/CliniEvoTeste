import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLoading } from '@/components/layout/PageLoading';

/** Redireciona para a ficha do paciente na aba Anamnese (rota legada). */
export default function PatientAnamnesePage() {
  const { id: patientId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (patientId) {
      navigate(`/patients/${patientId}?tab=anamnese`, { replace: true });
    } else {
      navigate('/patients', { replace: true });
    }
  }, [patientId, navigate]);

  return <PageLoading />;
}
