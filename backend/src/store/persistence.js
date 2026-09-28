const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

const DATA_DIR = path.resolve(__dirname, '../../data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CLIENTS_FILE)) {
    fs.writeFileSync(CLIENTS_FILE, '[]', 'utf8');
  }
  if (!fs.existsSync(APPOINTMENTS_FILE)) {
    fs.writeFileSync(APPOINTMENTS_FILE, '[]', 'utf8');
  }
}

function safeReadArray(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    logger.error('Erro ao ler JSON', { filePath, error: e?.message || e });
    return [];
  }
}

function safeWriteArray(filePath, value) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  } catch (e) {
    logger.error('Erro ao salvar JSON', { filePath, error: e?.message || e });
  }
}

function loadInitialData() {
  ensureDataFiles();
  return {
    clients: safeReadArray(CLIENTS_FILE),
    appointments: safeReadArray(APPOINTMENTS_FILE),
  };
}

function persistClients(clients) {
  ensureDataFiles();
  safeWriteArray(CLIENTS_FILE, clients);
}

function persistAppointments(appointments) {
  ensureDataFiles();
  safeWriteArray(APPOINTMENTS_FILE, appointments);
}

module.exports = {
  loadInitialData,
  persistClients,
  persistAppointments,
};
