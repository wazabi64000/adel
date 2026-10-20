import { query, queryOne, execute } from '../config/database.js';

const FIELDS = `id, title, image_url, image_public_id, status, created_by, created_at, updated_at`;

/** Liste toutes les photos de galerie (admin), avec filtre statique optionnel. */
export async function list({ status = '', limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(
    `SELECT ${FIELDS} FROM gallery_photos ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)],
  );
  const total = await queryOne(`SELECT COUNT(*) AS total FROM gallery_photos ${clause}`, params);
  return { rows, total: total?.total ?? 0 };
}

/** Photos publiées, visibles sur le site vitrine (galerie publique). */
export async function listPublished() {
  return query(
    `SELECT ${FIELDS} FROM gallery_photos
     WHERE status = 'published'
     ORDER BY created_at DESC`,
  );
}

export async function findById(id) {
  return queryOne(`SELECT ${FIELDS} FROM gallery_photos WHERE id = ? LIMIT 1`, [id]);
}

/** Ajoute une photo de galerie (uniquement par l'admin / coach). */
export async function create(data) {
  const result = await execute(
    `INSERT INTO gallery_photos (title, image_url, image_public_id, status, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.title ?? null,
      data.imageUrl,
      data.imagePublicId ?? null,
      data.status ?? 'published',
      data.createdBy ?? null,
    ],
  );
  return result.insertId;
}

export async function remove(id) {
  await execute('DELETE FROM gallery_photos WHERE id = ?', [id]);
}
