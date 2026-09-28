import { supabase } from '@/integrations/supabase/client';

/** Remove a instância se não restar nenhuma sessão de procedimento (ex.: após apagar da timeline). */
export async function deleteProcedureInstanceIfNoSessions(procedureInstanceId: string) {
  const { count, error: countError } = await supabase
    .from('procedure_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('procedure_instance_id', procedureInstanceId);

  if (countError) return { error: countError };
  if ((count ?? 0) > 0) return { error: null };

  await supabase.from('botox_reapplication_reminders').delete().eq('procedure_instance_id', procedureInstanceId);

  return supabase.from('procedure_instances').delete().eq('id', procedureInstanceId);
}

/** Remove fotos, lembretes e assinaturas vinculados antes de apagar a sessão do procedimento. */
export async function deleteProcedureSessionById(procedureSessionId: string) {
  const [photosRes, remindersRes, signaturesRes] = await Promise.all([
    supabase.from('procedure_photos').delete().eq('procedure_session_id', procedureSessionId),
    supabase.from('botox_reapplication_reminders').delete().eq('procedure_session_id', procedureSessionId),
    supabase.from('term_signatures').delete().eq('procedure_session_id', procedureSessionId),
  ]);

  if (photosRes.error) return { error: photosRes.error };
  if (remindersRes.error) return { error: remindersRes.error };
  if (signaturesRes.error) return { error: signaturesRes.error };

  return supabase.from('procedure_sessions').delete().eq('id', procedureSessionId);
}

/** Apaga sessões de procedimento ligadas e, em seguida, o registro em patient_sessions. */
export async function deletePatientSessionFromTimeline(
  patientSessionId: string,
  procedureSessionIds: string[]
) {
  const uniqueProcIds = [...new Set(procedureSessionIds.filter(Boolean))];

  let instanceIds: string[] = [];
  if (uniqueProcIds.length > 0) {
    const { data: linkedSessions, error: fetchError } = await supabase
      .from('procedure_sessions')
      .select('procedure_instance_id')
      .in('id', uniqueProcIds);
    if (fetchError) return { error: fetchError };
    instanceIds = [
      ...new Set(
        (linkedSessions ?? [])
          .map((s) => s.procedure_instance_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
  }

  for (const procId of uniqueProcIds) {
    const { error } = await deleteProcedureSessionById(procId);
    if (error) return { error };
  }

  await supabase.from('term_signatures').delete().eq('patient_session_id', patientSessionId);
  await supabase.from('patient_session_photos').delete().eq('patient_session_id', patientSessionId);

  const { error: patientSessionError } = await supabase
    .from('patient_sessions')
    .delete()
    .eq('id', patientSessionId);
  if (patientSessionError) return { error: patientSessionError };

  for (const instanceId of instanceIds) {
    const { error } = await deleteProcedureInstanceIfNoSessions(instanceId);
    if (error) return { error };
  }

  return { error: null };
}
