import { query, queryOne, execute } from '../config/database.js';

const FIELDS = `a.id, a.user_id, a.first_name, a.last_name, a.email, a.phone, a.birthdate,
  a.gender, a.height_cm, a.weight_kg, a.level, a.goal, a.notes, a.photo_url, a.is_active,
  a.created_at, a.updated_at`;

export async function list({ search = '', level, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (search) {
    where.push('(a.first_name LIKE ? OR a.last_name LIKE ? OR a.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (level) {
    where.push('a.level = ?');
    params.push(level);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(
    `SELECT ${FIELDS},
       (SELECT COUNT(*) FROM programs p WHERE p.athlete_id = a.id) AS programs_count
     FROM athletes a ${clause}
     ORDER BY a.last_name ASC, a.first_name ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)],
  );
  const total = await queryOne(`SELECT COUNT(*) AS total FROM athletes a ${clause}`, params);
  return { rows, total: total?.total ?? 0 };
}

export async function findAllActive() {
  return query(`SELECT ${FIELDS} FROM athletes a WHERE a.is_active = 1 ORDER BY a.last_name, a.first_name`);
}

export async function findById(id) {
  return queryOne(
    `SELECT ${FIELDS}, u.email AS login_email
     FROM athletes a LEFT JOIN users u ON u.id = a.user_id
     WHERE a.id = ? LIMIT 1`,
    [id],
  );
}

export async function findByUserId(userId) {
  return queryOne(`SELECT ${FIELDS} FROM athletes a WHERE a.user_id = ? LIMIT 1`, [userId]);
}

export async function create(data) {
  const result = await execute(
    `INSERT INTO athletes
      (user_id, first_name, last_name, email, phone, birthdate, gender, height_cm, weight_kg, level, goal, notes, photo_url, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.userId ?? null,
      data.firstName,
      data.lastName,
      data.email ?? null,
      data.phone ?? null,
      data.birthdate ?? null,
      data.gender ?? null,
      data.heightCm ?? null,
      data.weightKg ?? null,
      data.level ?? 'debutant',
      data.goal ?? null,
      data.notes ?? null,
      data.photoUrl ?? null,
      data.isActive ? 1 : 0,
    ],
  );
  return result.insertId;
}

export async function update(id, data) {
  await execute(
    `UPDATE athletes SET
       first_name = ?, last_name = ?, email = ?, phone = ?, birthdate = ?, gender = ?,
       height_cm = ?, weight_kg = ?, level = ?, goal = ?, notes = ?, photo_url = ?, is_active = ?
     WHERE id = ?`,
    [
      data.firstName,
      data.lastName,
      data.email ?? null,
      data.phone ?? null,
      data.birthdate ?? null,
      data.gender ?? null,
      data.heightCm ?? null,
      data.weightKg ?? null,
      data.level ?? 'debutant',
      data.goal ?? null,
      data.notes ?? null,
      data.photoUrl ?? null,
      data.isActive ? 1 : 0,
      id,
    ],
  );
}

export async function linkUser(athleteId, userId) {
  await execute('UPDATE athletes SET user_id = ? WHERE id = ?', [userId, athleteId]);
}

export async function remove(id) {
  await execute('DELETE FROM athletes WHERE id = ?', [id]);
}

export async function count() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM athletes');
  return row?.total ?? 0;
}
