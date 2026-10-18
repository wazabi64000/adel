import { query, queryOne, execute } from '../config/database.js';

/** Ajoute une photo de progression (avant/après, vue, date). */
export async function create(data) {
  const result = await execute(
    `INSERT INTO progress_photos
       (athlete_id, taken_on, phase, view_key, image_url, image_public_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.athleteId,
      data.takenOn,
      data.phase,
      data.view,
      data.imageUrl,
      data.imagePublicId ?? null,
      data.notes ?? null,
    ],
  );
  return result.insertId;
}

export async function listByAthlete(athleteId) {
  return query(
    `SELECT * FROM progress_photos
     WHERE athlete_id = ?
     ORDER BY taken_on DESC, id DESC`,
    [athleteId],
  );
}

export async function findById(id) {
  return queryOne('SELECT * FROM progress_photos WHERE id = ? LIMIT 1', [id]);
}

export async function remove(id) {
  await execute('DELETE FROM progress_photos WHERE id = ?', [id]);
}

export async function countByAthlete(athleteId) {
  const row = await queryOne(
    'SELECT COUNT(*) AS total FROM progress_photos WHERE athlete_id = ?',
    [athleteId],
  );
  return row?.total ?? 0;
}
