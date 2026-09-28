function getPublicAppBaseUrl() {
  const raw =
    process.env.APP_PUBLIC_URL ||
    process.env.VITE_APP_URL ||
    'https://www.clinievo.com.br';
  return String(raw).replace(/\/$/, '');
}

function buildTreatmentLinkMessage({ patientName, clinicName, procedureName, reportUrl, kind }) {
  const patient = String(patientName || '').trim() || 'Paciente';
  const clinic = String(clinicName || '').trim() || 'Clínica';
  const procedure = String(procedureName || '').trim() || 'tratamento';

  if (kind === 'emagrecimento') {
    return (
      `Aqui está seu relatório de acompanhamento de *${procedure}* da *${clinic}*:\n` +
      `${reportUrl}\n\n` +
      `Guarde o link com segurança. 💚`
    );
  }

  if (kind === 'botox') {
    return (
      `Seu *Programa de Botox* na *${clinic}* está ativo.\n\n` +
      `Para dúvidas sobre sessões ou pagamentos, use a opção *5* do menu para falar com a equipe.`
    );
  }

  return (
    `Aqui está seu relatório de evolução de *${procedure}* da *${clinic}*:\n` +
    `${reportUrl}\n\n` +
    `Guarde o link com segurança. 💚`
  );
}

module.exports = {
  getPublicAppBaseUrl,
  buildTreatmentLinkMessage,
};
