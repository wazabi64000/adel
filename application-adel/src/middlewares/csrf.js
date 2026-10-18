import crypto from 'node:crypto';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Protection CSRF par jeton synchronisé stocké en session.
 * Le jeton est exposé aux vues via `csrfToken`.
 */
export function csrf(req, res, next) {
  if (!req.session) next(); // sécurité : session requise

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

  if (!expected || !sent || sent.length !== expected.length) {
    return res.status(403).render('errors/403', { title: 'Requête invalide', message: 'Jeton de sécurité manquant ou invalide.' });
  }

  const a = Buffer.from(String(sent));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).render('errors/403', { title: 'Requête invalide', message: 'Jeton de sécurité invalide.' });
  }

  return next();
}
