import rateLimit from 'express-rate-limit';
import { slowDown } from 'express-slow-down';
import { securityLog } from './securityLog.js';

const jsonMessage = {
  error: 'Trop de tentatives. Merci de réessayer dans quelques minutes.',
  code: 'RATE_LIMIT',
};

function limitHandler(kind) {
  return (req, res, _next, options) => {
    securityLog('RATE_LIMIT', req, { kind, limit: options.limit });
    const wantsJson = req.accepts(['html', 'json']) === 'json' || req.path.startsWith('/admin/api');
    if (wantsJson) {
      return res.status(options.statusCode).json(jsonMessage);
    }
    if (typeof req.flash === 'function') {
      req.flash('error', jsonMessage.error);
    }
    return res.status(options.statusCode).send(jsonMessage.error);
  };
}

/** Ralentit progressivement — ne bloque jamais la requête. */
export const globalSlowDown = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 80,
  delayMs: (hits) => Math.min((hits - 80) * 40, 2000),
  maxDelayMs: 2000,
  validate: { delayMs: false },
});

/** Ralentissement auth (anti brute-force soft). */
export const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 5,
  delayMs: (hits) => Math.min(hits * 250, 4000),
  maxDelayMs: 4000,
  validate: { delayMs: false },
});

/** Limite stricte authentification. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonMessage,
  handler: limitHandler('auth'),
  skipSuccessfulRequests: true,
});

/** Formulaires publics (contact, accès). */
export const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonMessage,
  handler: limitHandler('form'),
});

/** Limite générale — plafond haut pour ne pas gêner le coach. */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 400,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonMessage,
  handler: limitHandler('global'),
  skip: (req) => {
    const p = req.path || '';
    return (
      p.startsWith('/css') ||
      p.startsWith('/js') ||
      p.startsWith('/fonts') ||
      p.startsWith('/img') ||
      p.startsWith('/media/') ||
      p === '/sw.js' ||
      p === '/manifest.webmanifest'
    );
  },
});

/** API catalogue / admin JSON. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonMessage,
  handler: limitHandler('api'),
});
