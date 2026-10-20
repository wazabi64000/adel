import { ZodError } from 'zod';
import config from '../config/env.js';
import { HttpError } from '../utils/http.js';
import { zodFieldErrors } from '../validators/index.js';

/** Route introuvable. */
export function notFound(req, res) {
  if (req.accepts(['html', 'json']) === 'json') {
    return res.status(404).json({ error: 'Ressource introuvable.', code: 'NOT_FOUND' });
  }
  return res.status(404).render('errors/404', { title: 'Page introuvable' });
}

/** Middleware d'erreur centralisé : Zod → champs, HttpError → message, 500 → générique. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const fieldErrors = zodFieldErrors(err);
    const message = fieldErrors.global || 'Certaines informations sont invalides.';
    if (req.accepts(['html', 'json']) === 'json') {
      return res.status(422).json({
        error: message,
        code: 'VALIDATION_ERROR',
        fields: fieldErrors,
      });
    }
    if (typeof req.flash === 'function') req.flash('error', message);
    return res.status(422).render('errors/error', {
      title: 'Données invalides',
      status: 422,
      message,
      fieldErrors,
    });
  }

  const status = err instanceof HttpError ? err.status : err.status || 500;

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} —`, err.message);
    if (!config.isProd) console.error(err.stack);
  }

  const message =
    status >= 500
      ? 'Une erreur interne est survenue. Merci de réessayer plus tard.'
      : err.message || 'Une erreur est survenue.';

  if (req.accepts(['html', 'json']) === 'json') {
    const body = { error: message, code: status >= 500 ? 'INTERNAL' : 'HTTP_ERROR' };
    if (status < 500 && err.details) body.fields = err.details;
    return res.status(status).json(body);
  }

  return res.status(status).render('errors/error', {
    title: status >= 500 ? 'Erreur serveur' : 'Erreur',
    status,
    message,
    fieldErrors: status < 500 && err.details ? err.details : null,
  });
}
