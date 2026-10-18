import { query, queryOne, execute } from '../config/database.js';

export async function create(data) {
  const result = await execute(
    'INSERT INTO contact_messages (name, email, phone, message) VALUES (?, ?, ?, ?)',
    [data.name, data.email, data.phone ?? null, data.message],
  );
  return result.insertId;
}

export async function list({ limit = 100, offset = 0 } = {}) {
  const rows = await query(
    'SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [Number(limit), Number(offset)],
  );
  const total = await queryOne('SELECT COUNT(*) AS total FROM contact_messages');
  return { rows, total: total?.total ?? 0 };
}

export async function markRead(id) {
  await execute('UPDATE contact_messages SET is_read = 1 WHERE id = ?', [id]);
}

export async function remove(id) {
  await execute('DELETE FROM contact_messages WHERE id = ?', [id]);
}

export async function countUnread() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM contact_messages WHERE is_read = 0');
  return row?.total ?? 0;
}

export async function count() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM contact_messages');
  return row?.total ?? 0;
}
