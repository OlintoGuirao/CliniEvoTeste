const express = require('express');
const router = express.Router();
const { postAnalyzeExam, postExtractExamText } = require('../controllers/aiController');

router.post('/ai/analyze-exam', postAnalyzeExam);
router.post('/ai/extract-exam-text', postExtractExamText);

module.exports = router;
