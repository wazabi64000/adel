import crypto from 'node:crypto';
import { query, queryOne, execute } from '../config/database.js';

export async function create(data) {
  const uuid = crypto.randomUUID();
  const result = await execute(
    'INSERT INTO access_requests (full_name, email, phone, message, uuid) VALUES (?, ?, ?, ?, ?)',
    [data.fullName, data.email, data.phone ?? null, data.message ?? null, uuid],
  );
  return { id: result.insertId, uuid };
}

export async function list({ status, limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(
    `SELECT * FROM access_requests ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)],
  );
  const total = await queryOne(`SELECT COUNT(*) AS total FROM access_requests ${clause}`, params);
  return { rows, total: total?.total ?? 0 };
}

export async function findById(id) {
  return queryOne('SELECT * FROM access_requests WHERE id = ? LIMIT 1', [id]);
}

export async function findByUuid(uuid) {
  return queryOne('SELECT * FROM access_requests WHERE uuid = ? LIMIT 1', [uuid]);
}

export async function setStatus(id, status) {
  await execute('UPDATE access_requests SET status = ? WHERE id = ?', [status, id]);
}

/** Valide une demande à partir de son UUID (lien e-mail du coach). */
export async function approveByUuid(uuid) {
  await execute(
    "UPDATE access_requests SET status = 'approved', approved_at = NOW() WHERE uuid = ? AND status <> 'approved'",
    [uuid],
  );
  return findByUuid(uuid);
}

export async function linkAthlete(id, athleteId) {
  await execute('UPDATE access_requests SET athlete_id = ? WHERE id = ?', [athleteId, id]);
}

export async function remove(id) {
  await execute('DELETE FROM access_requests WHERE id = ?', [id]);
}

export async function countPending() {
  const row = await queryOne("SELECT COUNT(*) AS total FROM access_requests WHERE status = 'pending'");
  return row?.total ?? 0;
}
