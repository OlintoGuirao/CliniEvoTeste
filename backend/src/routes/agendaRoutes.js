const express = require('express');
const router = express.Router();

const { authApiKey } = require('../middleware/authApiKey');
const { getAgenda, getHorarios, postAgendamento } = require('../controllers/agendaController');

router.get('/agenda/:profissionalId', authApiKey, getAgenda);
router.get('/horarios/:profissionalId', authApiKey, getHorarios);
router.post('/agendamento', authApiKey, postAgendamento);

module.exports = router;
