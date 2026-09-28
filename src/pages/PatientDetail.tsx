import { useParams } from 'react-router-dom';
import { PatientDetailView } from '@/components/patient-detail/PatientDetailView';
import { PageLoading } from '@/components/layout/PageLoading';

export default function PatientDetail() {
  const { id } = useParams();
  if (!id) return <PageLoading />;
  return <PatientDetailView patientId={id} variant="page" syncUrlTab />;
}
