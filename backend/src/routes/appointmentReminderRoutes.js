const express = require('express');
const {
  getReminder24hStatus,
  postSendMissingReminder24h,
} = require('../controllers/appointmentReminderController');

const router = express.Router();

router.get('/appointment-reminders/24h/status/:professionalId', getReminder24hStatus);
router.post(
  '/appointment-reminders/24h/send-missing/:professionalId',
  postSendMissingReminder24h
);

module.exports = router;
