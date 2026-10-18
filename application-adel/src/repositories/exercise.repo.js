import { query, queryOne, execute } from '../config/database.js';

const FIELDS = `e.id, e.program_day_id, e.name, e.description, e.muscle_group, e.equipment,
  e.type, e.sets, e.reps, e.rest_seconds, e.weight, e.image_url, e.video_url,
  e.order_index, e.created_at, e.updated_at`;

export async function listByDay(dayId) {
  return query(
    `SELECT ${FIELDS} FROM exercises e WHERE e.program_day_id = ? ORDER BY e.order_index ASC, e.id ASC`,
    [dayId],
  );
}

export async function findById(id) {
  return queryOne(`SELECT ${FIELDS}, e.program_day_id FROM exercises e WHERE e.id = ? LIMIT 1`, [id]);
}

export async function create(data) {
  const maxOrder = await queryOne(
    'SELECT COALESCE(MAX(order_index), -1) + 1 AS next FROM exercises WHERE program_day_id = ?',
    [data.programDayId],
  );
  const result = await execute(
    `INSERT INTO exercises
      (program_day_id, name, description, muscle_group, equipment, type, sets, reps, rest_seconds, weight, image_url, video_url, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.programDayId,
      data.name,
      data.description ?? null,
      data.muscleGroup ?? null,
      data.equipment ?? null,
      data.type ?? 'force',
      data.sets ?? null,
      data.reps ?? null,
      data.restSeconds ?? null,
      data.weight ?? null,
      data.imageUrl ?? null,
      data.videoUrl ?? null,
      data.orderIndex ?? maxOrder?.next ?? 0,
    ],
  );
  return result.insertId;
}

export async function update(id, data) {
  await execute(
    `UPDATE exercises SET
       name = ?, description = ?, muscle_group = ?, equipment = ?, type = ?, sets = ?,
       reps = ?, rest_seconds = ?, weight = ?, image_url = ?, video_url = ?
     WHERE id = ?`,
    [
      data.name,
      data.description ?? null,
      data.muscleGroup ?? null,
      data.equipment ?? null,
      data.type ?? 'force',
      data.sets ?? null,
      data.reps ?? null,
      data.restSeconds ?? null,
      data.weight ?? null,
      data.imageUrl ?? null,
      data.videoUrl ?? null,
      id,
    ],
  );
}

export async function remove(id) {
  await execute('DELETE FROM exercises WHERE id = ?', [id]);
}

export async function count() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM exercises');
  return row?.total ?? 0;
}
