const { normalizePhone } = require('./conversationStateStore');

const MAX_EVENTS = 500;
const debugEvents = [];

function pushDebugEvent(event) {
  debugEvents.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...event,
  });

  if (debugEvents.length > MAX_EVENTS) {
    debugEvents.splice(0, debugEvents.length - MAX_EVENTS);
  }
}

function listDebugEventsByPhone(phone) {
  const normalized = normalizePhone(phone);
  return debugEvents.filter((e) => normalizePhone(e.phone || '') === normalized);
}

function listAllDebugEvents(limit = 100) {
  return debugEvents.slice(-Math.max(1, limit));
}

module.exports = {
  pushDebugEvent,
  listDebugEventsByPhone,
  listAllDebugEvents,
};
