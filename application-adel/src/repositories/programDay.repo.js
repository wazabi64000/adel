import { query, queryOne, execute } from '../config/database.js';

export async function listByProgram(programId) {
  return query(
    `SELECT d.id, d.program_id, d.week_number, d.day_of_week, d.title, d.focus, d.session_type,
       d.scheduled_time, d.notes, d.is_rest_day,
       (SELECT COUNT(*) FROM exercises e WHERE e.program_day_id = d.id) AS exercises_count
     FROM program_days d
     WHERE d.program_id = ?
     ORDER BY d.week_number ASC, d.day_of_week ASC`,
    [programId],
  );
}

/** Crée une journée avec métadonnées de séance. */
export async function createDay({
  programId,
  weekNumber,
  dayOfWeek,
  title = null,
  focus = null,
  sessionType = 'full_body',
  scheduledTime = '18:00:00',
  notes = null,
  isRestDay = false,
}) {
  const result = await execute(
    `INSERT INTO program_days
       (program_id, week_number, day_of_week, title, focus, session_type, scheduled_time, notes, is_rest_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      programId,
      weekNumber,
      dayOfWeek,
      title,
      focus,
      sessionType === 'body_part' ? 'body_part' : 'full_body',
      scheduledTime || '18:00:00',
      notes,
      isRestDay ? 1 : 0,
    ],
  );
  return queryOne('SELECT * FROM program_days WHERE id = ?', [result.insertId]);
}

/** Retourne la journée en la créant si elle n'existe pas encore. */
export async function ensureDay(programId, weekNumber, dayOfWeek) {
  const existing = await queryOne(
    'SELECT * FROM program_days WHERE program_id = ? AND week_number = ? AND day_of_week = ? LIMIT 1',
    [programId, weekNumber, dayOfWeek],
  );
  if (existing) return existing;
  return createDay({ programId, weekNumber, dayOfWeek });
}

export async function findById(id) {
  return queryOne('SELECT * FROM program_days WHERE id = ? LIMIT 1', [id]);
}

export async function findByIdWithProgram(id) {
  return queryOne(
    `SELECT d.*, p.title AS program_title, p.athlete_id, p.location
     FROM program_days d JOIN programs p ON p.id = d.program_id
     WHERE d.id = ? LIMIT 1`,
    [id],
  );
}

export async function update(id, { title, focus, sessionType, scheduledTime, notes, isRestDay }) {
  await execute(
    `UPDATE program_days
     SET title = ?, focus = ?, session_type = ?, scheduled_time = COALESCE(?, scheduled_time),
         notes = ?, is_rest_day = ?
     WHERE id = ?`,
    [
      title ?? null,
      focus ?? null,
      sessionType === 'body_part' ? 'body_part' : 'full_body',
      scheduledTime ?? null,
      notes ?? null,
      isRestDay ? 1 : 0,
      id,
    ],
  );
}

export async function remove(id) {
  await execute('DELETE FROM program_days WHERE id = ?', [id]);
}

export async function count() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM program_days');
  return row?.total ?? 0;
}
