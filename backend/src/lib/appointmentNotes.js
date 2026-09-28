function buildAppointmentNotes(serviceName) {
  const name = String(serviceName || '').trim();
  if (!name) return 'Agendado via WhatsApp';
  return `Agendado via WhatsApp. Serviço: ${name}`;
}

function isTechnicalAppointmentNoteLine(line) {
  return (
    /^procedure_context:/i.test(line) ||
    /^programa_botox:/i.test(line) ||
    /^salon_procedure:/i.test(line) ||
    /^salon_recurring_schedule:/i.test(line) ||
    /^Valor:/i.test(line)
  );
}

/**
 * Nome que aparece no lembrete WhatsApp:
 * 1) "Serviço: X" (agendamento pelo bot)
 * 2) "Procedimento: X" (agenda salão / clínica)
 * 3) observação livre da agenda (ex.: "retorno", "Abdômen")
 * 4) fallback "Consulta"
 */
function extractProcedureFromNotes(notes) {
  const raw = String(notes || '').trim();
  if (!raw) return 'Consulta';

  const serviceMatch = raw.match(/Servi[cç]o:\s*(.+?)(?:\.|$)/i);
  if (serviceMatch) {
    const fromService = serviceMatch[1].trim();
    if (fromService) return fromService;
  }

  // Preferência: linhas "Procedimento: Nome" (sem metadados técnicos).
  const procedureNames = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^Procedimento:\s*(.+)$/i);
    let name = match?.[1]?.trim() || '';
    if (!name) continue;
    name = name
      .replace(/\bsalon_procedure:[0-9a-f-]{36}\b/gi, '')
      .replace(/\bsalon_recurring_schedule:[0-9a-f-]{36}\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (name) procedureNames.push(name);
  }
  if (procedureNames.length > 0) {
    return procedureNames.join(' · ');
  }

  const cleaned = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !isTechnicalAppointmentNoteLine(line))
    .join(' ')
    .replace(/^Agendado via WhatsApp\.?\s*/i, '')
    // Fallback se metadados vierem na mesma linha sem quebra.
    .replace(/\bsalon_procedure:[0-9a-f-]{36}\b/gi, '')
    .replace(/\bsalon_recurring_schedule:[0-9a-f-]{36}\b/gi, '')
    .replace(/\bprocedure_context:\S+/gi, '')
    .replace(/\bprograma_botox:\S+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned) return 'Consulta';
  return cleaned;
}

module.exports = { buildAppointmentNotes, extractProcedureFromNotes };
