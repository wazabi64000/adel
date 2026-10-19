import cors from 'cors';
import config from '../config/env.js';

/**
 * CORS strict : uniquement l'origine de l'app (+ origines déclarées).
 * Les formulaires same-origin n'ont pas besoin de CORS ; utile pour API / PWA.
 */
export function createCorsMiddleware() {
  const allowed = new Set(
    [config.appUrl, ...(config.cors.origins || [])]
      .map((o) => String(o || '').replace(/\/$/, ''))
      .filter(Boolean),
  );

  return cors({
    origin(origin, callback) {
      // Requêtes same-origin / curl / cron : pas d'Origin
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (allowed.has(normalized) || allowed.has('*')) {
        return callback(null, true);
      }
      // Dev : localhost
      if (!config.isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    maxAge: 600,
    optionsSuccessStatus: 204,
  });
}
