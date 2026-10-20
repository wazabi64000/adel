import crypto from 'node:crypto';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Protection CSRF par jeton synchronisé stocké en session.
 * Le jeton est exposé aux vues via `csrfToken`.
 */
export function csrf(req, res, next) {
  if (!req.session) return next(); // sécurité : session requise

  // Cron interne authentifié par CRON_SECRET — hors CSRF navigateur.
  const path = req.path || '';
  if (path.startsWith('/internal/cron')) return next();

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;
  res.locals.csrfField = '';

  if (SAFE_METHODS.includes(req.method)) return next();

  // Les requêtes multipart (upload) ne sont pas encore parsées ici : multer
  // est monté sur la route. On diffère la vérification à `csrfCheck`, appelé
  // juste après multer sur ces routes.
  if (req.is('multipart/form-data')) return next();

  return csrfCheck(req, res, next);
}

/**
 * Vérifie le jeton CSRF. À appeler après le parsing du corps
 * (multer pour les formulaires multipart).
 */
export function csrfCheck(req, res, next) {
  if (SAFE_METHODS.includes(req.method)) return next();
  if (!req.session) return next();

  const expected = req.session.csrfToken;
  const sent = req.body?._csrf || req.get('x-csrf-token');

  const sentBuf = Buffer.from(String(sent || ''));
  const expectedBuf = Buffer.from(String(expected || ''));
  const mismatch = !expected || !sent || sentBuf.length !== expectedBuf.length
    || !crypto.timingSafeEqual(sentBuf, expectedBuf);
  if (mismatch) {
    if (req.accepts(['html', 'json']) === 'json') {
      return res.status(403).json({ error: 'Jeton de sécurité invalide.', code: 'CSRF' });
    }
    return res.status(403).render('errors/403', { title: 'Requête invalide', message: 'Jeton de sécurité invalide.' });
  }

  return next();
}
