const DEFAULT_BIRTHDAY_MESSAGE =
  'Olá, {{nome}}! 🎉\n\n' +
  'Parabéns pelo seu aniversário! Que seu dia seja incrível.\n\n' +
  'Um abraço,\n{{profissional}}';

function firstNameFrom(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || '';
}

function getBrazilYmd(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === 'year')?.value),
    month: Number(parts.find((p) => p.type === 'month')?.value),
    day: Number(parts.find((p) => p.type === 'day')?.value),
  };
}

function getBrazilBirthdayContext(date = new Date()) {
  return getBrazilYmd(date);
}

function getBrazilIsoDayOfWeek(date = new Date()) {
  const { year, month, day } = getBrazilYmd(date);
  const base = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const jsDay = base.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function ymdToNumber(ymd) {
  return ymd.year * 10000 + ymd.month * 100 + ymd.day;
}

function parseBirthMonthDay(dateOfBirth) {
  const raw = String(dateOfBirth || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { month: Number(match[2]), day: Number(match[3]) };
}

/** Semana ISO (segunda a domingo), alinhada ao card do Dashboard. */
function getBrazilWeekRange(date = new Date()) {
  const ymd = getBrazilYmd(date);
  const isoDayOfWeek = getBrazilIsoDayOfWeek(date);
  const mondayOffset = isoDayOfWeek - 1;
  const base = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12, 0, 0));
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    isoDayOfWeek,
    weekStart: {
      year: monday.getUTCFullYear(),
      month: monday.getUTCMonth() + 1,
      day: monday.getUTCDate(),
    },
    weekEnd: {
      year: sunday.getUTCFullYear(),
      month: sunday.getUTCMonth() + 1,
      day: sunday.getUTCDate(),
    },
  };
}

function getBrazilWeekBirthdayContext(date = new Date()) {
  return {
    ...getBrazilYmd(date),
    ...getBrazilWeekRange(date),
  };
}

function isBirthdayInWeek(dateOfBirth, weekStart, weekEnd) {
  const parsed = parseBirthMonthDay(dateOfBirth);
  if (!parsed) return false;

  const weekStartNum = ymdToNumber(weekStart);
  const weekEndNum = ymdToNumber(weekEnd);
  let year = weekStart.year;
  let birthdayNum = year * 10000 + parsed.month * 100 + parsed.day;

  if (birthdayNum < weekStartNum) {
    year += 1;
    birthdayNum = year * 10000 + parsed.month * 100 + parsed.day;
  }

  return birthdayNum >= weekStartNum && birthdayNum <= weekEndNum;
}

function getBirthdayOccurrenceYear(dateOfBirth, weekStart) {
  const parsed = parseBirthMonthDay(dateOfBirth);
  if (!parsed) return weekStart.year;

  const weekStartNum = ymdToNumber(weekStart);
  let year = weekStart.year;
  let birthdayNum = year * 10000 + parsed.month * 100 + parsed.day;

  if (birthdayNum < weekStartNum) {
    year += 1;
  }

  return year;
}

function buildBirthdayMessage(template, patientName, professionalName) {
  const nome = String(patientName || 'Paciente').trim() || 'Paciente';
  const primeiroNome = firstNameFrom(nome) || nome;
  const profissional = String(professionalName || 'Profissional').trim() || 'Profissional';
  const base = String(template || '').trim() || DEFAULT_BIRTHDAY_MESSAGE;

  return base
    .replace(/\{\{nome\}\}/gi, nome)
    .replace(/\{\{primeiro_nome\}\}/gi, primeiroNome)
    .replace(/\{\{profissional\}\}/gi, profissional);
}

module.exports = {
  DEFAULT_BIRTHDAY_MESSAGE,
  buildBirthdayMessage,
  getBrazilBirthdayContext,
  getBrazilWeekBirthdayContext,
  isBirthdayInWeek,
  getBirthdayOccurrenceYear,
  parseBirthMonthDay,
};
