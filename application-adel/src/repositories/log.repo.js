import { query, queryOne, execute } from '../config/database.js';

/** Insère ou met à jour une réalisation (unique par exercice/athlète/date). */
export async function upsert(data) {
  await execute(
    `INSERT INTO exercise_logs
       (exercise_id, athlete_id, log_date, week_number, sets_done, reps_done, weight_used, duration_min, rpe, feeling, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       week_number = VALUES(week_number),
       sets_done = VALUES(sets_done),
       reps_done = VALUES(reps_done),
       weight_used = VALUES(weight_used),
       duration_min = VALUES(duration_min),
       rpe = VALUES(rpe),
       feeling = VALUES(feeling),
       notes = VALUES(notes)`,
    [
      data.exerciseId,
      data.athleteId,
      data.logDate,
      data.weekNumber ?? 1,
      data.setsDone ?? null,
      data.repsDone ?? null,
      data.weightUsed ?? null,
      data.durationMin ?? null,
      data.rpe ?? null,
      data.feeling ?? null,
      data.notes ?? null,
    ],
  );
}

export async function listByAthlete(athleteId, { limit = 100, offset = 0 } = {}) {
  return query(
    `SELECT l.id, l.log_date, l.week_number, l.sets_done, l.reps_done, l.weight_used,
       l.duration_min, l.rpe, l.feeling, l.notes, e.name AS exercise_name, e.id AS exercise_id,
       d.program_id
     FROM exercise_logs l
     JOIN exercises e ON e.id = l.exercise_id
     JOIN program_days d ON d.id = e.program_day_id
     WHERE l.athlete_id = ?
     ORDER BY l.log_date DESC
     LIMIT ? OFFSET ?`,
    [athleteId, Number(limit), Number(offset)],
  );
}

export async function listByExercise(exerciseId) {
  return query(
    'SELECT * FROM exercise_logs WHERE exercise_id = ? ORDER BY log_date ASC',
    [exerciseId],
  );
}

export async function findByExerciseAndDate(exerciseId, athleteId, logDate) {
  return queryOne(
    'SELECT * FROM exercise_logs WHERE exercise_id = ? AND athlete_id = ? AND log_date = ? LIMIT 1',
    [exerciseId, athleteId, logDate],
  );
}

export async function remove(id, athleteId) {
  await execute('DELETE FROM exercise_logs WHERE id = ? AND athlete_id = ?', [id, athleteId]);
}

/* ----------------------------- Statistiques ----------------------------- */

/** Nombre total de séances (jours distincts) et de réalisations. */
export async function athleteSummary(athleteId) {
  return queryOne(
    `SELECT
       COUNT(*) AS logs_count,
       COUNT(DISTINCT log_date) AS sessions_count,
       COALESCE(SUM(duration_min), 0) AS total_minutes,
       COALESCE(AVG(rpe), 0) AS avg_rpe,
       MIN(log_date) AS first_log,
       MAX(log_date) AS last_log
     FROM exercise_logs
     WHERE athlete_id = ?`,
    [athleteId],
  );
}

/** Statistiques par semaine pour un athlète. */
export async function athleteWeekly(athleteId) {
  return query(
    `SELECT week_number,
       COUNT(*) AS logs_count,
       COUNT(DISTINCT log_date) AS sessions_count,
       COALESCE(SUM(duration_min), 0) AS total_minutes,
       COALESCE(AVG(rpe), 0) AS avg_rpe
     FROM exercise_logs
     WHERE athlete_id = ?
     GROUP BY week_number
     ORDER BY week_number ASC`,
    [athleteId],
  );
}

/** Taux de réalisation : logs enregistrés vs exercices planifiés actifs. */
export async function completionForAthlete(athleteId) {
  return queryOne(
    `SELECT
       (SELECT COUNT(DISTINCT e.id)
          FROM exercises e
          JOIN program_days d ON d.id = e.program_day_id
          JOIN programs p ON p.id = d.program_id
         WHERE p.athlete_id = ? AND p.status <> 'archived') AS planned_exercises,
       (SELECT COUNT(DISTINCT l.exercise_id)
          FROM exercise_logs l
         WHERE l.athlete_id = ?) AS done_exercises`,
    [athleteId, athleteId],
  );
}

/** Activité globale (dashboard admin) : réalisations sur les N derniers jours. */
export async function recentActivity(days = 30) {
  return query(
    `SELECT l.log_date,
       COUNT(*) AS logs_count,
       COUNT(DISTINCT l.athlete_id) AS athletes_count
     FROM exercise_logs l
     WHERE l.log_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY l.log_date
     ORDER BY l.log_date ASC`,
    [Number(days)],
  );
}

/** Top athlètes par nombre de réalisations. */
export async function topAthletes(limit = 5) {
  return query(
    `SELECT a.id, a.first_name, a.last_name, COUNT(l.id) AS logs_count,
       COUNT(DISTINCT l.log_date) AS sessions_count
     FROM athletes a
     JOIN exercise_logs l ON l.athlete_id = a.id
     GROUP BY a.id, a.first_name, a.last_name
     ORDER BY logs_count DESC
     LIMIT ?`,
    [Number(limit)],
  );
}

export async function count() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM exercise_logs');
  return row?.total ?? 0;
}

export async function countThisWeek() {
  const row = await queryOne(
    'SELECT COUNT(*) AS total FROM exercise_logs WHERE log_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)',
  );
  return row?.total ?? 0;
}
