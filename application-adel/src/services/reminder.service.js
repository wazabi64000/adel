import { query, queryOne, execute } from '../config/database.js';
import config from '../config/env.js';
import { sendSessionReminder } from './mail.service.js';

const DAY_NAMES_FR = {
  1: 'lundi',
  2: 'mardi',
  3: 'mercredi',
  4: 'jeudi',
  5: 'vendredi',
  6: 'samedi',
  7: 'dimanche',
};

/** Parts YYYY-MM-DD / HH:MM in Europe/Paris (or APP_TIMEZONE). */
function zonedParts(date = new Date(), timeZone = config.timezone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** Convertit date+heure locale (APP_TIMEZONE) → epoch ms UTC. */
function localDateTimeToUtcMs(dateStr, timeStr, timeZone = config.timezone) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm, ss] = String(timeStr || '18:00:00').split(':').map(Number);
  let guess = Date.UTC(y, m - 1, d, hh, mm || 0, ss || 0);
  for (let i = 0; i < 4; i += 1) {
    const parts = zonedParts(new Date(guess), timeZone);
    const [py, pm, pd] = parts.date.split('-').map(Number);
    const got = Date.UTC(py, pm - 1, pd, parts.hour, parts.minute, 0);
    const want = Date.UTC(y, m - 1, d, hh, mm || 0, 0);
    const delta = want - got;
    if (delta === 0) break;
    guess += delta;
  }
  return guess;
}

/**
 * Date calendaire d'une séance : semaine N + jour de la semaine
 * relative à program.start_date.
 */
export function sessionCalendarDate(startDate, weekNumber, dayOfWeek) {
  if (!startDate) return null;
  const start = new Date(`${startDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  // JS: 0=dim … 6=sam → ISO 1=lun … 7=dim
  const jsDow = start.getUTCDay();
  const startIso = jsDow === 0 ? 7 : jsDow;
  const offsetDays = (Number(weekNumber) - 1) * 7 + (Number(dayOfWeek) - startIso);
  const out = new Date(start.getTime());
  out.setUTCDate(out.getUTCDate() + offsetDays);
  return out.toISOString().slice(0, 10);
}

async function alreadySent(programDayId, sessionDate) {
  const row = await queryOne(
    'SELECT id FROM session_reminders WHERE program_day_id = ? AND session_date = ? LIMIT 1',
    [programDayId, sessionDate],
  );
  return Boolean(row);
}

async function markSent(programDayId, athleteId, sessionDate) {
  await execute(
    `INSERT INTO session_reminders (program_day_id, athlete_id, session_date, reminded_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE reminded_at = NOW()`,
    [programDayId, athleteId, sessionDate],
  );
}

/**
 * Charge les séances actives susceptibles d'avoir un rappel aujourd'hui / demain.
 */
async function loadCandidateSessions() {
  return query(
    `SELECT
       d.id AS day_id,
       d.week_number,
       d.day_of_week,
       d.title AS day_title,
       d.focus,
       d.scheduled_time,
       d.is_rest_day,
       p.id AS program_id,
       p.title AS program_title,
       p.start_date,
       p.athlete_id,
       a.first_name,
       a.email AS athlete_email,
       u.email AS login_email
     FROM program_days d
     JOIN programs p ON p.id = d.program_id
     JOIN athletes a ON a.id = p.athlete_id
     LEFT JOIN users u ON u.id = a.user_id
     WHERE p.status = 'active'
       AND d.is_rest_day = 0
       AND p.start_date IS NOT NULL
       AND a.is_active = 1`,
  );
}

/**
 * Envoie les rappels 1 h avant l'heure de séance (fenêtre ~±8 min).
 * @returns {Promise<{checked:number, sent:number, skipped:number, errors:number}>}
 */
export async function processSessionReminders(now = new Date()) {
  const stats = { checked: 0, sent: 0, skipped: 0, errors: 0 };
  let rows = [];
  try {
    rows = await loadCandidateSessions();
  } catch (err) {
    console.error('[reminders] chargement :', err.message);
    return { ...stats, errors: 1, error: err.message };
  }

  const leadMs = 60 * 60 * 1000;
  const windowMs = 8 * 60 * 1000;
  const nowMs = now.getTime();

  for (const row of rows) {
    stats.checked += 1;
    const sessionDate = sessionCalendarDate(row.start_date, row.week_number, row.day_of_week);
    if (!sessionDate) {
      stats.skipped += 1;
      continue;
    }
    const time = row.scheduled_time || '18:00:00';
    const startMs = localDateTimeToUtcMs(sessionDate, time);
    const remindAt = startMs - leadMs;
    if (Math.abs(nowMs - remindAt) > windowMs) {
      stats.skipped += 1;
      continue;
    }

    try {
      if (await alreadySent(row.day_id, sessionDate)) {
        stats.skipped += 1;
        continue;
      }
      const email = (row.athlete_email || row.login_email || '').trim();
      if (!email) {
        stats.skipped += 1;
        continue;
      }

      const timeLabel = String(time).slice(0, 5);
      const result = await sendSessionReminder({
        name: row.first_name,
        email,
        programTitle: row.program_title,
        programId: row.program_id,
        dayTitle: row.day_title || `Séance ${DAY_NAMES_FR[row.day_of_week] || ''}`,
        focus: row.focus,
        sessionDate,
        sessionTime: timeLabel,
        dayName: DAY_NAMES_FR[row.day_of_week] || '',
      });

      if (result.sent) {
        await markSent(row.day_id, row.athlete_id, sessionDate);
        stats.sent += 1;
      } else {
        stats.skipped += 1;
      }
    } catch (err) {
      console.error('[reminders] envoi :', err.message);
      stats.errors += 1;
    }
  }

  return stats;
}
