import { query, queryOne, execute } from '../config/database.js';

const FIELDS = `id, session_id, athlete_id, author_id, content, status, validated_at, sent_at, created_at, updated_at`;

/** Rapport d'une séance photo, brouillon compris. */
export async function findBySession(sessionId) {
  return queryOne(`SELECT ${FIELDS} FROM photo_reports WHERE session_id = ? LIMIT 1`, [sessionId]);
}

/** Rapports validés d'un sportif, du plus récent au plus ancien. */
export async function listValidatedByAthlete(athleteId) {
  return query(
    `SELECT r.id, r.session_id, r.content, r.validated_at, r.sent_at, ps.session_date, ps.notes
       FROM photo_reports r
       JOIN photo_sessions ps ON ps.id = r.session_id
      WHERE r.athlete_id = ? AND r.status = 'validated'
      ORDER BY r.validated_at DESC, r.id DESC`,
    [athleteId],
  );
}

/** Enregistre ou met à jour le texte sans changer un rapport déjà validé. */
export async function saveContent({ sessionId, athleteId, authorId, content }) {
  await execute(
    `INSERT INTO photo_reports (session_id, athlete_id, author_id, content, status)
     VALUES (?, ?, ?, ?, 'draft')
     ON DUPLICATE KEY UPDATE
       content = VALUES(content),
       author_id = VALUES(author_id)`,
    [sessionId, athleteId, authorId, content],
  );
}

/** Valide le rapport. Le texte remplace la version précédente. */
export async function validate({ sessionId, athleteId, authorId, content }) {
  await execute(
    `INSERT INTO photo_reports (session_id, athlete_id, author_id, content, status, validated_at)
     VALUES (?, ?, ?, ?, 'validated', NOW())
     ON DUPLICATE KEY UPDATE
       content = VALUES(content),
       author_id = VALUES(author_id),
       status = 'validated',
       validated_at = NOW()`,
    [sessionId, athleteId, authorId, content],
  );
}

/** Note l'envoi du rapport à l'athlète. */
export async function markSent(sessionId) {
  await execute('UPDATE photo_reports SET sent_at = NOW() WHERE session_id = ?', [sessionId]);
}
