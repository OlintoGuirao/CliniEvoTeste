function formatMonthLabelPt(mesKey) {
  const [y, m] = String(mesKey || '').split('-');
  const month = Number(m);
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  if (!y || !Number.isFinite(month) || month < 1 || month > 12) return String(mesKey || '');
  return `${names[month - 1]}/${y}`;
}

function formatMoneyBrl(amount) {
  return Number(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getBrazilBillingContext(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return {
    mesReferencia: `${year}-${month}`,
    dayOfMonth: day,
  };
}

/** Lista meses YYYY-MM de startKey até endKey (inclusive). */
function buildMonthRange(startKey, endKey) {
  const [sy, sm] = String(startKey).split('-').map(Number);
  const [ey, em] = String(endKey).split('-').map(Number);
  if (!sy || !sm || !ey || !em) return [];
  const out = [];
  const d = new Date(sy, sm - 1, 1);
  const end = new Date(ey, em - 1, 1);
  while (d <= end) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    out.push(`${y}-${m}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

function monthKeyFromIsoDate(iso) {
  const raw = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw.slice(0, 7);
}

/**
 * Mensagem de cobrança com mês/meses pendentes + valor total.
 */
function buildCobrancaBotoxPixMessage({
  patientName,
  pendingMonthKeys,
  valorMensalidade,
  valorTotal,
}) {
  const patient = String(patientName || 'Paciente').trim() || 'Paciente';
  const months = (pendingMonthKeys || []).map(formatMonthLabelPt);
  const count = months.length;
  const monthWord = count === 1 ? 'mês' : 'meses';
  const monthsText =
    count === 0
      ? ''
      : count === 1
        ? months[0]
        : count === 2
          ? `${months[0]} e ${months[1]}`
          : `${months.slice(0, -1).join(', ')} e ${months[months.length - 1]}`;

  const lines = [
    `Olá, ${patient}!`,
    '',
    count === 1
      ? `Verifiquei no sistema que há pendência no programa de Botox do ${monthWord} ${monthsText}.`
      : `Verifiquei no sistema que há pendência no programa de Botox dos ${monthWord} ${monthsText}.`,
    '',
    count > 1
      ? `O valor total é ${formatMoneyBrl(valorTotal)} (${count} × ${formatMoneyBrl(valorMensalidade)}).`
      : `O valor da mensalidade é ${formatMoneyBrl(valorTotal)}.`,
    '',
    'Segue o QR Code PIX para pagamento. Assim que o pagamento for efetuado, se quiser envie o comprovante para facilitar a identificação.',
    '',
    'Qualquer dúvida, estamos à disposição.',
  ];

  return lines.join('\n');
}

/** @deprecated mensagem antiga sem PIX — mantida para compat */
function buildCobrancaBotoxMessage(patientName, professionalName) {
  const patient = String(patientName || 'Paciente').trim() || 'Paciente';
  const professional = String(professionalName || 'Profissional').trim() || 'Profissional';
  return (
    `Olá, ${patient}! Aqui é ${professional}. ` +
    'Passando para lembrar que a mensalidade do seu programa de Botox está pendente. ' +
    'Por favor, entre em contato para regularizar o pagamento. Qualquer dúvida, estamos à disposição.'
  );
}

module.exports = {
  buildCobrancaBotoxMessage,
  buildCobrancaBotoxPixMessage,
  getBrazilBillingContext,
  buildMonthRange,
  monthKeyFromIsoDate,
  formatMonthLabelPt,
  formatMoneyBrl,
};
