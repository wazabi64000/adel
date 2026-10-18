import rateLimit from 'express-rate-limit';

const message = { error: 'Trop de tentatives. Merci de réessayer dans quelques minutes.' };

/** Limite stricte pour l'authentification (anti brute-force). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

/** Limite pour les formulaires publics (contact, demande d'accès). */
export const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

/** Limite générale de l'application. */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});
