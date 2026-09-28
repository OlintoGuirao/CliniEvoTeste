'use strict';

const {
  HUMAN_HANDOFF_TIMEOUT_MS,
  isGreeting,
  isMenuCommand,
  clearState,
  handleGreeting,
} = require('../core');

async function human_handoff({ phone, profissionalId, text, professionalName, current }) {
  const handoffAgeMs = Date.now() - Number(current.createdAt || 0);
  if (handoffAgeMs >= HUMAN_HANDOFF_TIMEOUT_MS || isGreeting(text) || isMenuCommand(text)) {
    clearState(phone);
    return handleGreeting({ phone, profissionalId, professionalName });
  }
  return { reply: null, ignored: true, stateStep: 'human_handoff' };
}

module.exports = {
  human_handoff,
};
