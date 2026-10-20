import { query, queryOne, execute } from '../config/database.js';

const FIELDS = `id, session_id, view_key, image_url, image_public_id, mime_type, file_size, created_at`;

/** Liste les photos d'une séance. */
export async function listBySession(sessionId) {
  return query(`SELECT ${FIELDS} FROM session_photos WHERE session_id = ? ORDER BY view_key`, [
    sessionId,
  ]);
}

/** Retourne une photo avec vérification d'appartenance à la séance. */
export async function findById(id) {
  return queryOne(`SELECT ${FIELDS} FROM session_photos WHERE id = ? LIMIT 1`, [id]);
}

/** Ajoute (ou remplace) une photo pour une vue donnée dans une séance. */
export async function upsert(data) {
  await execute(
    `INSERT INTO session_photos (session_id, view_key, image_url, image_public_id, mime_type, file_size)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       image_url = VALUES(image_url),
       image_public_id = VALUES(image_public_id),
       mime_type = VALUES(mime_type),
       file_size = VALUES(file_size)`,
    [
      data.sessionId,
      data.viewKey,
      data.imageUrl,
      data.imagePublicId ?? null,
      data.mimeType,
      data.fileSize,
    ],
  );
}

/** Supprime une photo. */
export async function remove(id) {
  await execute('DELETE FROM session_photos WHERE id = ?', [id]);
}

/** Supprime toutes les photos d'une séance. */
export async function removeBySession(sessionId) {
  await execute('DELETE FROM session_photos WHERE session_id = ?', [sessionId]);
}
