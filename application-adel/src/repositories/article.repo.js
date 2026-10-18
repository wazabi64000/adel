import { query, queryOne, execute } from '../config/database.js';

const FIELDS = `id, title, slug, excerpt, content, category, cover_url, status, read_minutes,
  published_at, author_id, created_at, updated_at`;

export async function list({ status, search = '', limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (search) {
    where.push('(title LIKE ? OR category LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(
    `SELECT ${FIELDS} FROM articles ${clause} ORDER BY COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)],
  );
  const total = await queryOne(`SELECT COUNT(*) AS total FROM articles ${clause}`, params);
  return { rows, total: total?.total ?? 0 };
}

export async function listPublished(limit = 6) {
  return query(
    `SELECT ${FIELDS} FROM articles WHERE status = 'published'
     ORDER BY COALESCE(published_at, created_at) DESC LIMIT ?`,
    [Number(limit)],
  );
}

export async function findById(id) {
  return queryOne(`SELECT ${FIELDS} FROM articles WHERE id = ? LIMIT 1`, [id]);
}

export async function findBySlug(slug) {
  return queryOne(`SELECT ${FIELDS} FROM articles WHERE slug = ? LIMIT 1`, [slug]);
}

export async function slugExists(slug, exceptId = null) {
  const row = exceptId
    ? await queryOne('SELECT id FROM articles WHERE slug = ? AND id <> ? LIMIT 1', [slug, exceptId])
    : await queryOne('SELECT id FROM articles WHERE slug = ? LIMIT 1', [slug]);
  return Boolean(row);
}

export async function create(data) {
  const result = await execute(
    `INSERT INTO articles (title, slug, excerpt, content, category, cover_url, status, read_minutes, published_at, author_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.slug,
      data.excerpt ?? null,
      data.content ?? null,
      data.category ?? null,
      data.coverUrl ?? null,
      data.status ?? 'draft',
      data.readMinutes ?? null,
      data.publishedAt ?? null,
      data.authorId ?? null,
    ],
  );
  return result.insertId;
}

export async function update(id, data) {
  await execute(
    `UPDATE articles SET title = ?, slug = ?, excerpt = ?, content = ?, category = ?, cover_url = ?,
       status = ?, read_minutes = ?, published_at = ?
     WHERE id = ?`,
    [
      data.title,
      data.slug,
      data.excerpt ?? null,
      data.content ?? null,
      data.category ?? null,
      data.coverUrl ?? null,
      data.status ?? 'draft',
      data.readMinutes ?? null,
      data.publishedAt ?? null,
      id,
    ],
  );
}

export async function remove(id) {
  await execute('DELETE FROM articles WHERE id = ?', [id]);
}

export async function count({ status } = {}) {
  const row = status
    ? await queryOne('SELECT COUNT(*) AS total FROM articles WHERE status = ?', [status])
    : await queryOne('SELECT COUNT(*) AS total FROM articles');
  return row?.total ?? 0;
}
