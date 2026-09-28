const conversationState = new Map();

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d]/g, '');
}

function getState(phone) {
  const key = normalizePhone(phone);
  return conversationState.get(key) || null;
}

function upsertState(phone, state) {
  const key = normalizePhone(phone);
  conversationState.set(key, state);
  return state;
}

function clearState(phone) {
  const key = normalizePhone(phone);
  conversationState.delete(key);
}

module.exports = {
  conversationState,
  getState,
  upsertState,
  clearState,
  normalizePhone,
};
