const express = require('express');
const router = express.Router();
const { getDebugEvents, getDebugEventsByPhone, simulateIncoming } = require('../controllers/debugController');

router.get('/debug/events', getDebugEvents);
router.get('/debug/events/:phone', getDebugEventsByPhone);
router.post('/debug/simulate-incoming', simulateIncoming);

module.exports = router;
