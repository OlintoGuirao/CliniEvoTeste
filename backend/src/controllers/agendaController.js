const { getAppointmentsByProfessionalId, createAppointment } = require('../store/memoryStore');
const { getAvailableSlotsForProfessional } = require('../services/schedulingService');

async function getAgenda(req, res) {
  const { profissionalId } = req.params;
  const list = getAppointmentsByProfessionalId(profissionalId);
  res.json({ professionalId: profissionalId, appointments: list });
}

async function getHorarios(req, res) {
  const { profissionalId } = req.params;
  const slots = getAvailableSlotsForProfessional({ professionalId: profissionalId, daysAhead: 3 });
  res.json({ professionalId: profissionalId, slots });
}

async function postAgendamento(req, res) {
  const { professionalId, phone, clientName, service, appointmentDate, appointmentTime } = req.body || {};

  if (!professionalId || !phone || !clientName || !service || !appointmentDate || !appointmentTime) {
    return res.status(400).json({
      error: 'Campos obrigatórios: professionalId, phone, clientName, service, appointmentDate, appointmentTime',
    });
  }

  const appointment = await createAppointment({
    professionalId,
    phone,
    clientName,
    service,
    appointmentDate,
    appointmentTime,
  });

  return res.status(201).json({ appointment });
}

module.exports = { getAgenda, getHorarios, postAgendamento };
