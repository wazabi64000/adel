import { query, queryOne, execute } from '../config/database.js';

const FIELDS = `id, session_id, author_id, content, created_at`;

/** Liste les commentaires d'une séance (propriétaire uniquement). */
export async function listBySession(sessionId, authorId) {
  return query(
    `SELECT ${FIELDS}, u.name AS author_name
       FROM photo_comments pc
       JOIN users u ON u.id = pc.author_id
      WHERE pc.session_id = ? AND pc.author_id = ?
      ORDER BY pc.created_at DESC`,
    [sessionId, authorId],
  );
}

/** Ajoute un commentaire à une séance (propriétaire uniquement). */
export async function create(data) {
  const result = await execute(
    `INSERT INTO photo_comments (session_id, author_id, content)
     VALUES (?, ?, ?)`,
    [data.sessionId, data.authorId, data.content],
  );
  return result.insertId;
}

/** Supprime un commentaire (propriétaire uniquement). */
export async function remove(id, authorId) {
  await execute('DELETE FROM photo_comments WHERE id = ? AND author_id = ?', [id, authorId]);
}
