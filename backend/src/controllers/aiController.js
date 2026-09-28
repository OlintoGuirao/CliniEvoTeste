const { analyzeExamText } = require('../services/aiReplyService');
const { extractTextFromExam } = require('../services/examTextService');

async function postAnalyzeExam(req, res) {
  try {
    const examText = String(req.body?.examText || '').trim();
    const examName = String(req.body?.examName || '').trim();
    const patientId = String(req.body?.patientId || '').trim();

    if (!examText) {
      return res.status(400).json({ error: 'examText é obrigatório' });
    }

    const result = await analyzeExamText({ examText, examName, patientId });
    return res.json({ ok: true, summary: result.summary });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Erro interno ao analisar exame' });
  }
}

module.exports = {
  postAnalyzeExam,
  async postExtractExamText(req, res) {
    try {
      const fileUrl = String(req.body?.fileUrl || '').trim();
      const mimeType = String(req.body?.mimeType || '').trim();
      if (!fileUrl) {
        return res.status(400).json({ ok: false, error: 'fileUrl é obrigatório' });
      }

      const result = await extractTextFromExam({ fileUrl, mimeType });
      return res.json({ ok: true, ...result });
    } catch (_) {
      return res.status(500).json({ ok: false, error: 'Erro interno ao extrair texto do exame' });
    }
  },
};
