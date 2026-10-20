import crypto from 'node:crypto';

/** Clé secrète pour signer les tokens d'accès aux photos privées. */
const SECRET = process.env.PHOTO_ACCESS_SECRET || crypto.randomBytes(32).toString('hex');

/** Durée de validité d'un token d'accès à une image : 1 heure. */
const TTL_MS = 60 * 60 * 1000;

/**
 * Génère un token d'accès signé et limité dans le temps pour une image privée.
 * @returns {string} token au format base64url.signature
 */
export function createImageAccessToken(athleteId, sessionId, viewKey) {
  const payload = {
    a: Number(athleteId),
    s: Number(sessionId),
    v: String(viewKey),
    e: Date.now() + TTL_MS,
  };
  const base = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SECRET)
    .update(base)
    .digest('base64url');
  return `${base}.${sig}`;
}

/**
 * Vérifie un token d'accès signé.
 * @returns {object|null} le payload si valide, null sinon.
 */
export function verifyImageAccessToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [base, sig] = token.split('.');
  if (!base || !sig) return null;
  try {
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(base)
      .digest('base64url');
    // Comparaison à temps constant pour éviter les attaques par timing.
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    const payload = JSON.parse(Buffer.from(base, 'base64url').toString('utf8'));
    if (Date.now() > payload.e) return null;
    return payload;
  } catch {
    return null;
  }
}
