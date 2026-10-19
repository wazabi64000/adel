import config from '../config/env.js';
import { HttpError } from '../utils/http.js';

/** Route introuvable. */
export function notFound(req, res) {
  if (req.accepts(['html', 'json']) === 'json') {
    return res.status(404).json({ error: 'Ressource introuvable.' });
  }
  return res.status(404).render('errors/404', { title: 'Page introuvable' });
}

/** Middleware d'erreur centralisé : ne jamais exposer les détails internes. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err instanceof HttpError ? err.status : err.status || 500;

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} —`, err.message);
    if (!config.isProd) console.error(err.stack);
  }

  const message =
    status >= 500 ? 'Une erreur interne est survenue. Merci de réessayer plus tard.' : err.message;

  if (req.accepts(['html', 'json']) === 'json') {
    const body = { error: message };
    if (status < 500 && err.details) body.details = err.details;
    return res.status(status).json(body);
  }

  return res.status(status).render('errors/error', {
    title: status >= 500 ? 'Erreur serveur' : 'Erreur',
    status,
    message,
  });
}
