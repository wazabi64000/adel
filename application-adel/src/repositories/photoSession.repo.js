import { query, queryOne, execute } from '../config/database.js';

const FIELDS = `id, athlete_id, session_date, notes, created_at, updated_at`;

/** Photos envoyées par les sportifs, de la plus récente à la plus ancienne. */
export async function listAllSent() {
  return query(
    `SELECT ps.id AS session_id, ps.athlete_id, ps.session_date, ps.notes,
            sp.view_key, sp.image_url, pr.status AS report_status
       FROM photo_sessions ps
       JOIN session_photos sp ON sp.session_id = ps.id
       LEFT JOIN photo_reports pr ON pr.session_id = ps.id
      ORDER BY ps.session_date DESC, ps.id DESC, sp.view_key ASC`,
  );
}

/** Photos de suivi d'un sportif (mêmes champs que listAllSent). */
export async function listSentByAthlete(athleteId) {
  return query(
    `SELECT ps.id AS session_id, ps.athlete_id, ps.session_date, ps.notes,
            sp.view_key, sp.image_url, pr.status AS report_status
       FROM photo_sessions ps
       JOIN session_photos sp ON sp.session_id = ps.id
       LEFT JOIN photo_reports pr ON pr.session_id = ps.id
      WHERE ps.athlete_id = ?
      ORDER BY ps.session_date DESC, ps.id DESC, sp.view_key ASC`,
    [athleteId],
  );
}

/** Liste les séances photo d'un sportif (les siennes uniquement). */
export async function listByAthlete(athleteId) {
  return query(
    `SELECT ${FIELDS},
            (SELECT COUNT(*) FROM session_photos sp WHERE sp.session_id = ps.id) AS photos_count
       FROM photo_sessions ps
      WHERE ps.athlete_id = ?
      ORDER BY ps.session_date DESC, ps.id DESC`,
    [athleteId],
  );
}

/** Retourne une séance photo. */
export async function findById(id) {
  return queryOne(`SELECT ${FIELDS} FROM photo_sessions WHERE id = ? LIMIT 1`, [id]);
}

/** Retourne une séance avec vérification d'appartenance au sportif. */
export async function findByIdForAthlete(id, athleteId) {
  return queryOne(`SELECT ${FIELDS} FROM photo_sessions WHERE id = ? AND athlete_id = ? LIMIT 1`, [
    id,
    athleteId,
  ]);
}

/** Crée une séance photo. */
export async function create(data) {
  const result = await execute(
    `INSERT INTO photo_sessions (athlete_id, session_date, notes)
     VALUES (?, ?, ?)`,
    [data.athleteId, data.sessionDate, data.notes ?? null],
  );
  return result.insertId;
}

/** Met à jour les métadonnées d'une séance. */
export async function update(id, athleteId, data) {
  await execute(
    `UPDATE photo_sessions SET session_date = ?, notes = ? WHERE id = ? AND athlete_id = ?`,
    [data.sessionDate, data.notes ?? null, id, athleteId],
  );
}

/** Supprime une séance (les photos liées sont supprimées en cascade). */
export async function remove(id, athleteId) {
  await execute('DELETE FROM photo_sessions WHERE id = ? AND athlete_id = ?', [id, athleteId]);
}

/** Toutes les séances d'un sportif ayant une photo pour une vue donnée (comparatif). */
export async function listWithView(athleteId, viewKey) {
  return query(
    `SELECT ps.id, ps.session_date, ps.notes, sp.image_url, sp.created_at AS photo_created_at
       FROM photo_sessions ps
       JOIN session_photos sp ON sp.session_id = ps.id
      WHERE ps.athlete_id = ? AND sp.view_key = ?
      ORDER BY ps.session_date ASC, ps.id ASC`,
    [athleteId, viewKey],
  );
}
