import { getChatbotApiBase } from '@/lib/programaBotoxBilling';

/** Apenas Evolution (sem fallback). Preferir `sendWhatsappTextPreferEvolution`. */
export async function sendSalonAppointmentConfirmViaEvolution(params: {
  professionalId: string;
  bookingProfessionalId?: string | null;
  patientId?: string | null;
  phone: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  const base = getChatbotApiBase();
  if (!base) {
    return { ok: false, error: 'Configure VITE_CHATBOT_API_URL para enviar pelo WhatsApp conectado.' };
  }

  const res = await fetch(`${base}/whatsapp/send-text/${params.professionalId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: params.patientId ?? null,
      bookingProfessionalId: params.bookingProfessionalId ?? null,
      phone: params.phone,
      message: params.message,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof data?.error === 'string'
          ? data.error
          : 'Falha ao enviar confirmação pelo WhatsApp conectado.',
    };
  }

  return { ok: true };
}
