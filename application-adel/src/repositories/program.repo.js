import { query, queryOne, execute } from '../config/database.js';

const FIELDS = `p.id, p.athlete_id, p.title, p.description, p.location, p.goal, p.level,
  p.weeks, p.sessions_per_week, p.start_date, p.end_date, p.status, p.created_by, p.created_at, p.updated_at`;

export async function list({ athleteId, location, status, search = '', limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (athleteId) {
    where.push('p.athlete_id = ?');
    params.push(athleteId);
  }
  if (location) {
    where.push('p.location = ?');
    params.push(location);
  }
  if (status) {
    where.push('p.status = ?');
    params.push(status);
  }
  if (search) {
    where.push('p.title LIKE ?');
    params.push(`%${search}%`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(
    `SELECT ${FIELDS}, a.first_name, a.last_name,
       (SELECT COUNT(*) FROM program_days d WHERE d.program_id = p.id) AS days_count,
       (SELECT COUNT(*) FROM exercises e JOIN program_days d ON d.id = e.program_day_id WHERE d.program_id = p.id) AS exercises_count
     FROM programs p
     JOIN athletes a ON a.id = p.athlete_id
     ${clause}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)],
  );
  const total = await queryOne(`SELECT COUNT(*) AS total FROM programs p ${clause}`, params);
  return { rows, total: total?.total ?? 0 };
}

export async function findByAthlete(athleteId, { status } = {}) {
  const where = ['p.athlete_id = ?'];
  const params = [athleteId];
  if (status) {
    where.push('p.status = ?');
    params.push(status);
  }
  return query(
    `SELECT ${FIELDS},
       (SELECT COUNT(*) FROM program_days d WHERE d.program_id = p.id) AS days_count
     FROM programs p
     WHERE ${where.join(' AND ')}
     ORDER BY p.created_at DESC`,
    params,
  );
}

export async function findById(id) {
  return queryOne(
    `SELECT ${FIELDS}, a.first_name, a.last_name, a.email AS athlete_email,
       a.user_id AS athlete_user_id
     FROM programs p
     JOIN athletes a ON a.id = p.athlete_id
     WHERE p.id = ? LIMIT 1`,
    [id],
  );
}

export async function create(data) {
  const result = await execute(
    `INSERT INTO programs
       (athlete_id, title, description, location, goal, level, weeks, sessions_per_week, start_date, end_date, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.athleteId,
      data.title,
      data.description ?? null,
      data.location ?? 'salle',
      data.goal ?? null,
      data.level ?? 'debutant',
      data.weeks ?? 4,
      data.sessionsPerWeek ?? 3,
      data.startDate ?? null,
      data.endDate ?? null,
      data.status ?? 'active',
      data.createdBy ?? null,
    ],
  );
  return result.insertId;
}

export async function update(id, data) {
  await execute(
    `UPDATE programs SET
       athlete_id = ?, title = ?, description = ?, location = ?, goal = ?, level = ?,
       weeks = ?, sessions_per_week = ?, start_date = ?, end_date = ?, status = ?
     WHERE id = ?`,
    [
      data.athleteId,
      data.title,
      data.description ?? null,
      data.location ?? 'salle',
      data.goal ?? null,
      data.level ?? 'debutant',
      data.weeks ?? 4,
      data.sessionsPerWeek ?? 3,
      data.startDate ?? null,
      data.endDate ?? null,
      data.status ?? 'active',
      id,
    ],
  );
}

export async function setStatus(id, status) {
  await execute('UPDATE programs SET status = ? WHERE id = ?', [status, id]);
}

export async function remove(id) {
  await execute('DELETE FROM programs WHERE id = ?', [id]);
}

export async function count({ status } = {}) {
  if (status) {
    const row = await queryOne('SELECT COUNT(*) AS total FROM programs WHERE status = ?', [status]);
    return row?.total ?? 0;
  }
  const row = await queryOne('SELECT COUNT(*) AS total FROM programs');
  return row?.total ?? 0;
}

export async function countByLocation() {
  return query('SELECT location, COUNT(*) AS total FROM programs GROUP BY location');
}
