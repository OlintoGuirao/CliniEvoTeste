'use strict';

const {
  getState,
  findClientByPhone,
  isIdleState,
  isPatientFullyRegistered,
  handleRegisteredPatientIdle,
} = require('./core');
const {
  STATE_HANDLERS,
  handleGuestIdle,
  tryHandleViewAppointment,
} = require('./handlers');

/** Steps that originally appeared AFTER the global view_* interceptor in processMessage. */
const STEPS_AFTER_VIEW_MATCH = new Set([
  'treatment_pick',
  'promo_details_offer',
  'reschedule_pick',
  'promo_schedule_offer',
  'promotion_pick',
  'procedure_pick',
  'guest_services',
  'welcome_ask_name',
  'cadastro_nascimento',
  'cadastro_nome',
]);

async function processMessage({ phone, profissionalId, text, professionalName }) {
  const current = getState(phone);
  const normalizedText = String(text || '').trim();
  const existingClient = await findClientByPhone({ phone, professionalId: profissionalId });
  const ctx = {
    phone,
    profissionalId,
    text,
    professionalName,
    existingClient,
    current,
    normalizedText,
  };

  if (current?.step && current.profissionalId === profissionalId) {
    const handler = STATE_HANDLERS[current.step];
    if (handler) {
      // Preserve original order: view_* can intercept before late-step handlers
      if (STEPS_AFTER_VIEW_MATCH.has(current.step)) {
        const viewResult = await tryHandleViewAppointment(ctx);
        if (viewResult) return viewResult;
      }
      return handler(ctx);
    }
  }

  // Original fallthrough: view_* also applies on idle / unknown steps
  const viewResult = await tryHandleViewAppointment(ctx);
  if (viewResult) return viewResult;

  if (isIdleState(current) && !isPatientFullyRegistered(existingClient)) {
    return handleGuestIdle(ctx);
  }
  if (isIdleState(current)) {
    return handleRegisteredPatientIdle({
      phone,
      profissionalId,
      professionalName,
      existingClient,
      text,
      current,
    });
  }

  return {
    reply: 'Não entendi. Digite *0* para voltar ao menu ou *oi* para recomeçar.',
    stateStep: current?.step ?? 0,
  };
}

module.exports = { processMessage };
