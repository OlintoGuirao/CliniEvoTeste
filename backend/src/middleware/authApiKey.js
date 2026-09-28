const { getProfessionalById } = require('../store/memoryStore');

function authApiKey(req, res, next) {
  const apiKey = req.header('x-api-key') || req.header('x-professional-api-key');
  const professionalId = req.params.profissionalId || req.body?.professionalId;

  if (!apiKey || !professionalId) {
    return res.status(401).json({ error: 'API key e profissionalId são obrigatórios.' });
  }

  const prof = getProfessionalById(professionalId);
  if (!prof) return res.status(404).json({ error: 'Profissional não encontrado.' });

  if (prof.apiKey !== apiKey) {
    return res.status(403).json({ error: 'API key inválida para este profissional.' });
  }

  req.professional = prof;
  next();
}

module.exports = { authApiKey };
