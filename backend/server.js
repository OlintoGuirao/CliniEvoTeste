require('dotenv').config();

const express = require('express');
const cors = require('cors');
const whatsappRoutes = require('./src/routes/whatsappRoutes');
const botoxBillingRoutes = require('./src/routes/botoxBillingRoutes');
const budgetQuoteBillingRoutes = require('./src/routes/budgetQuoteBillingRoutes');
const agendaRoutes = require('./src/routes/agendaRoutes');
const debugRoutes = require('./src/routes/debugRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const whatsappPromotionRoutes = require('./src/routes/whatsappPromotionRoutes');
const birthdayWhatsappRoutes = require('./src/routes/birthdayWhatsappRoutes');
const appointmentReminderRoutes = require('./src/routes/appointmentReminderRoutes');
const cobrancaRoutes = require('./src/routes/cobrancaRoutes');
const atendimentoRoutes = require('./src/routes/atendimentoRoutes');
const salonSessionPhotosRoutes = require('./src/routes/salonSessionPhotosRoutes');
const salonAppointmentConfirmRoutes = require('./src/routes/salonAppointmentConfirmRoutes');
const whatsappSendTextRoutes = require('./src/routes/whatsappSendTextRoutes');
const { startBotoxBillingScheduler } = require('./src/jobs/botoxBillingScheduler');
const { startAppointmentReminderScheduler } = require('./src/jobs/appointmentReminderScheduler');
const { startBirthdayWhatsappScheduler } = require('./src/jobs/birthdayWhatsappScheduler');
const { logger } = require('./src/utils/logger');
const { rateLimitMiddleware } = require('./src/middleware/rateLimit');

const app = express();

// Necessário para IP correto atrás de proxy/nginx (Vercel rewrite → VPS).
app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://www.clinievo.com.br',
  'https://clinievo.com.br',
];

const extraOrigins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
for (const o of extraOrigins) {
  if (o && !allowedOrigins.includes(o)) allowedOrigins.push(o);
}

const allowedOriginsLc = new Set(allowedOrigins.map((u) => u.toLowerCase()));

function corsOriginAllowed(originHeader) {
  if (!originHeader) return true;
  return allowedOriginsLc.has(String(originHeader).trim().toLowerCase());
}

const corsOptions = {
  origin(origin, callback) {
    if (corsOriginAllowed(origin)) {
      return callback(null, true);
    }
    logger.warn(`CORS bloqueado para origin: ${origin || '(vazio)'}`);
    return callback(new Error('Origin não permitida por CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '2mb' }));

app.use(rateLimitMiddleware);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use(whatsappRoutes);
app.use(botoxBillingRoutes);
app.use(budgetQuoteBillingRoutes);
app.use(agendaRoutes);
app.use(debugRoutes);
app.use(aiRoutes);
app.use(whatsappPromotionRoutes);
app.use(birthdayWhatsappRoutes);
app.use(appointmentReminderRoutes);
app.use(cobrancaRoutes);
app.use(atendimentoRoutes);
app.use(salonSessionPhotosRoutes);
app.use(salonAppointmentConfirmRoutes);
app.use(whatsappSendTextRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
  startBotoxBillingScheduler();
  startAppointmentReminderScheduler();
  startBirthdayWhatsappScheduler();
});
