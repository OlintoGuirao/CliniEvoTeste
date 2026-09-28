'use strict';

const booking = require('./booking');
const cancel = require('./cancel');
const reschedule = require('./reschedule');
const registration = require('./registration');
const promotions = require('./promotions');
const faq = require('./faq');
const consultas = require('./consultas');
const treatments = require('./treatments');
const guest = require('./guest');
const handoff = require('./handoff');
const { handleGuestIdle } = require('./idle');

const STATE_HANDLERS = {
  human_handoff: handoff.human_handoff,
  confirm_booking: booking.confirm_booking,
  time_pick: booking.time_pick,
  date_pick: booking.date_pick,
  procedure_pick: booking.procedure_pick,
  cancel_confirm: cancel.cancel_confirm,
  cancel_pick: cancel.cancel_pick,
  confirm_birthdate: registration.confirm_birthdate,
  update_birthdate: registration.update_birthdate,
  cadastro_nascimento: registration.cadastro_nascimento,
  cadastro_nome: registration.cadastro_nome,
  faq_pick: faq.faq_pick,
  consultas_browse: consultas.consultas_browse,
  consultas_procedure_filter: consultas.consultas_procedure_filter,
  consultas_list: consultas.consultas_list,
  treatment_pick: treatments.treatment_pick,
  promo_details_offer: promotions.promo_details_offer,
  reschedule_pick: reschedule.reschedule_pick,
  promo_schedule_offer: promotions.promo_schedule_offer,
  promotion_pick: promotions.promotion_pick,
  guest_services: guest.guest_services,
  welcome_ask_name: guest.welcome_ask_name,
};

module.exports = {
  STATE_HANDLERS,
  handleGuestIdle,
  tryHandleViewAppointment: consultas.tryHandleViewAppointment,
};
