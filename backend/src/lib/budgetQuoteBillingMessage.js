const { getBrazilBillingContext } = require('../lib/botoxBillingMessage');

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

/**
 * Mensagem de cobrança PIX de parcelas de orçamento.
 */
function buildCobrancaOrcamentoPixMessage({
  patientName,
  pendingMonthKeys,
  valorTotal,
  quoteTitle,
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

  const title = String(quoteTitle || '').trim();
  const titleBit = title ? ` (${title})` : '';

  const lines = [
    `Olá, ${patient}!`,
    '',
    count === 1
      ? `Verifiquei no sistema que há pendência no seu orçamento${titleBit} do ${monthWord} ${monthsText}.`
      : `Verifiquei no sistema que há pendência no seu orçamento${titleBit} dos ${monthWord} ${monthsText}.`,
    '',
    `Valor total: ${formatMoneyBrl(valorTotal)}.`,
    '',
    'Segue o QR Code PIX para pagamento. Qualquer dúvida, estamos à disposição.',
  ];

  return lines.join('\n');
}

module.exports = {
  getBrazilBillingContext,
  formatMonthLabelPt,
  formatMoneyBrl,
  buildCobrancaOrcamentoPixMessage,
};
