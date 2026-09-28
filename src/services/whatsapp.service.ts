import { supabase } from '@/integrations/supabase/client';

const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;

/**
 * Dispara o envio de um lembrete de confirmação via WhatsApp para um agendamento.
 * Atualiza confirmation_sent_at no banco após o envio.
 */
export async function sendAppointmentReminder(appointmentId: string): Promise<void> {
  if (!N8N_URL) throw new Error('VITE_N8N_WEBHOOK_URL nao definida');

  const res = await fetch(`${N8N_URL}/webhook/send-reminder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointment_id: appointmentId }),
  });

  if (!res.ok) throw new Error('Falha ao enviar lembrete');

  // Campo pode ainda nao existir no tipo gerado; fazemos cast para manter o fluxo do service.
  const { error } = await supabase
    .from('appointments')
    .update({ confirmation_sent_at: new Date().toISOString() } as any)
    .eq('id', appointmentId);

  if (error) throw error;
}

