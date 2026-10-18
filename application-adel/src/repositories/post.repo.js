import { query, queryOne, execute } from '../config/database.js';

const FIELDS = `id, title, content, image_url, status, published_at, author_id, created_at, updated_at`;

export async function list({ status, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(
    `SELECT ${FIELDS} FROM posts ${clause} ORDER BY COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)],
  );
  const total = await queryOne(`SELECT COUNT(*) AS total FROM posts ${clause}`, params);
  return { rows, total: total?.total ?? 0 };
}

export async function listPublished(limit = 6) {
  return query(
    `SELECT ${FIELDS} FROM posts WHERE status = 'published'
     ORDER BY COALESCE(published_at, created_at) DESC LIMIT ?`,
    [Number(limit)],
  );
}

export async function findById(id) {
  return queryOne(`SELECT ${FIELDS} FROM posts WHERE id = ? LIMIT 1`, [id]);
}

export async function create(data) {
  const result = await execute(
    `INSERT INTO posts (title, content, image_url, status, published_at, author_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.title ?? null,
      data.content,
      data.imageUrl ?? null,
      data.status ?? 'draft',
      data.publishedAt ?? null,
      data.authorId ?? null,
    ],
  );
  return result.insertId;
}

export async function update(id, data) {
  await execute(
    `UPDATE posts SET title = ?, content = ?, image_url = ?, status = ?, published_at = ? WHERE id = ?`,
    [
      data.title ?? null,
      data.content,
      data.imageUrl ?? null,
      data.status ?? 'draft',
      data.publishedAt ?? null,
      id,
    ],
  );
}

export async function remove(id) {
  await execute('DELETE FROM posts WHERE id = ?', [id]);
}

export async function count({ status } = {}) {
  const row = status
    ? await queryOne('SELECT COUNT(*) AS total FROM posts WHERE status = ?', [status])
    : await queryOne('SELECT COUNT(*) AS total FROM posts');
  return row?.total ?? 0;
}
