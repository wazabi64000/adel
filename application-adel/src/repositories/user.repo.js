import { query, queryOne, execute } from '../config/database.js';

const PUBLIC_FIELDS =
  'id, name, email, role, is_active, must_change_password, last_login_at, created_at, updated_at';

export async function findByEmail(email) {
  return queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
}

export async function findById(id) {
  return queryOne(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ? LIMIT 1`, [id]);
}

export async function findByIdWithPassword(id) {
  return queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
}

export async function list({ role, search = '', limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (role) {
    where.push('role = ?');
    params.push(role);
  }
  if (search) {
    where.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(
    `SELECT ${PUBLIC_FIELDS} FROM users ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)],
  );
  const total = await queryOne(`SELECT COUNT(*) AS total FROM users ${clause}`, params);
  return { rows, total: total?.total ?? 0 };
}

export async function create({
  name,
  email,
  passwordHash,
  role = 'athlete',
  isActive = 1,
  mustChangePassword = 0,
}) {
  const result = await execute(
    'INSERT INTO users (name, email, password_hash, role, is_active, must_change_password) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, passwordHash, role, isActive ? 1 : 0, mustChangePassword ? 1 : 0],
  );
  return result.insertId;
}

/** Met à jour le mot de passe et, par défaut, lève l'obligation de changement. */
export async function updatePassword(id, passwordHash, { mustChangePassword = 0 } = {}) {
  await execute('UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?', [
    passwordHash,
    mustChangePassword ? 1 : 0,
    id,
  ]);
}

export async function setMustChangePassword(id, value) {
  await execute('UPDATE users SET must_change_password = ? WHERE id = ?', [value ? 1 : 0, id]);
}

export async function updateProfile(id, { name, email, isActive }) {
  await execute('UPDATE users SET name = ?, email = ?, is_active = ? WHERE id = ?', [
    name,
    email,
    isActive ? 1 : 0,
    id,
  ]);
}

export async function touchLogin(id) {
  await execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);
}

export async function remove(id) {
  await execute('DELETE FROM users WHERE id = ?', [id]);
}

export async function countByRole(role) {
  const row = await queryOne('SELECT COUNT(*) AS total FROM users WHERE role = ?', [role]);
  return row?.total ?? 0;
}
