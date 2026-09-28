function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDateYYYYMMDD(d) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function minutesToTimeStr(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function nowPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const WEEKDAYS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const WEEKDAYS_FULL_PT = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

function formatDateBRFromYmd(dateStr) {
  const v = String(dateStr || '').trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatWeekdayNameBRFromYmd(dateStr) {
  const v = String(dateStr || '').trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return WEEKDAYS_FULL_PT[d.getDay()] || '';
}

function formatDateWithWeekdayBR(dateStr) {
  const v = String(dateStr || '').trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  const weekday = WEEKDAYS_PT[d.getDay()] || '';
  return `${m[3]}/${m[2]}/${m[1]} (${weekday})`;
}

function parseAppointmentDateTimeBR(appointmentDate, startTime) {
  const date = String(appointmentDate || '').trim();
  const time = String(startTime || '00:00').slice(0, 5);
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const tm = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!tm) return null;
  // Agenda é horário de Brasília (sem DST desde 2019). Evita deslocar a janela 24h na VPS em UTC.
  const hh = String(Number(tm[1])).padStart(2, '0');
  const mi = String(Number(tm[2])).padStart(2, '0');
  const iso = `${m[1]}-${m[2]}-${m[3]}T${hh}:${mi}:00-03:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Data/hora atuais em America/Sao_Paulo (para queries de lembrete). */
function getBrazilDateTimeParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    today: `${parts.year}-${parts.month}-${parts.day}`,
    nowTime: `${hour}:${parts.minute}:${parts.second}`,
  };
}

/** Soma dias a uma data YYYY-MM-DD no calendário de Brasília. */
function addDaysToYmd(ymd, days) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const base = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00-03:00`);
  if (Number.isNaN(base.getTime())) return null;
  base.setTime(base.getTime() + Number(days) * 24 * 60 * 60 * 1000);
  return getBrazilDateTimeParts(base).today;
}

function getBrazilTomorrowYmd(date = new Date()) {
  const { today } = getBrazilDateTimeParts(date);
  return addDaysToYmd(today, 1);
}

module.exports = {
  formatDateYYYYMMDD,
  minutesToTimeStr,
  nowPlusDays,
  formatDateBRFromYmd,
  formatWeekdayNameBRFromYmd,
  formatDateWithWeekdayBR,
  parseAppointmentDateTimeBR,
  getBrazilDateTimeParts,
  addDaysToYmd,
  getBrazilTomorrowYmd,
};
