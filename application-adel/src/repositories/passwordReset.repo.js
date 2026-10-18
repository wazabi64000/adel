import crypto from 'node:crypto';
import { query, queryOne, execute } from '../config/database.js';

/** Hache le jeton en clair (on ne stocke jamais le jeton brut). */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Crée un jeton de réinitialisation valable 1 heure. */
export async function create(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await execute(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt],
  );
  return token;
}

/** Retourne la demande non utilisée correspondant au jeton, si valide. */
export async function findValid(token) {
  const tokenHash = hashToken(token);
  return queryOne(
    `SELECT * FROM password_resets
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  );
}

export async function markUsed(id) {
  await execute('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [id]);
}

export async function invalidateForUser(userId) {
  await execute('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [
    userId,
  ]);
}

export async function countActive() {
  const row = await queryOne(
    'SELECT COUNT(*) AS total FROM password_resets WHERE used_at IS NULL AND expires_at > NOW()',
  );
  return row?.total ?? 0;
}

export { query };
