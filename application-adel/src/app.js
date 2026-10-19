import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import methodOverride from 'method-override';
import helmet from 'helmet';
import flash from 'connect-flash';

import config, { PUBLIC_DIR, EXERCISE_MEDIA_DIR } from './config/env.js';
import { PRIVATE_PREFIXES } from './services/policy.service.js';
import { pool } from './config/database.js';
import { configureViews, assertViewsPresent } from './config/twig.js';
import routes from './routes/index.js';
import cronRoutes from './routes/cron.routes.js';
import { attachUser } from './middlewares/auth.js';
import { csrf } from './middlewares/csrf.js';
import { templateLocals } from './middlewares/locals.js';
import { globalLimiter, globalSlowDown } from './middlewares/rateLimit.js';
import { createCorsMiddleware } from './middlewares/cors.js';
import { securityResponseLogger } from './middlewares/securityLog.js';
import { notFound, errorHandler } from './middlewares/errors.js';

export function createApp() {
  const app = express();

  assertViewsPresent();
  configureViews(app);

  if (config.isProd) app.set('trust proxy', 1);

  /* ------------------------------- Sécurité ------------------------------- */
  app.use(securityResponseLogger);
  app.use(createCorsMiddleware());
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          scriptSrc: ["'self'"],
          // La landing utilise des attributs style inline — autorisés via 'unsafe-inline'.
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: config.isProd ? [] : null,
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: config.isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      xFrameOptions: { action: 'sameorigin' },
      noSniff: true,
      xssFilter: true,
      hidePoweredBy: true,
    }),
  );

  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    );
    next();
  });

  app.use((req, res, next) => {
    const path = req.path || '';
    const isPrivate = PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    if (isPrivate) {
      res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.set('Cache-Control', 'no-store');
    }
    next();
  });

  /* -------------------------------- Parsing ------------------------------- */
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(methodOverride('_method'));

  /* --------- PWA : SW + manifest jamais en cache longue durée ------------ */
  app.get('/sw.js', (_req, res) => {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
      'Content-Type': 'application/javascript; charset=utf-8',
    });
    res.sendFile('sw.js', { root: PUBLIC_DIR });
  });
  app.get('/manifest.webmanifest', (_req, res) => {
    res.set({
      'Cache-Control': 'no-cache, must-revalidate',
      'Content-Type': 'application/manifest+json; charset=utf-8',
    });
    res.sendFile('manifest.webmanifest', { root: PUBLIC_DIR });
  });

  /* ------------------------------ Fichiers statiques ---------------------- */
  app.use(
    express.static(PUBLIC_DIR, {
      maxAge: config.isProd ? '7d' : 0,
      etag: true,
    }),
  );
  // GIF catalogue exercices (storage/ hors public/)
  app.use(
    '/media/exercises',
    express.static(EXERCISE_MEDIA_DIR, {
      maxAge: config.isProd ? '7d' : 0,
      etag: true,
      fallthrough: false,
    }),
  );

  /* --------------------------------- Session ------------------------------ */
  // Réutilise le pool applicatif : un 2ᵉ pool (défaut express-mysql-session)
  // doublait les connexions et saturait max_user_connections AlwaysData.
  const MySQLStore = MySQLStoreFactory(session);
  const sessionStore = new MySQLStore(
    {
      createDatabaseTable: true,
      // Sur serverless, un timer d'expiration garde des connexions ouvertes.
      clearExpired: !config.isProd,
      checkExpirationInterval: 1000 * 60 * 30,
      expiration: config.session.maxAge,
      schema: {
        tableName: 'sessions',
        columnNames: {
          session_id: 'session_id',
          expires: 'expires',
          data: 'data',
        },
      },
    },
    pool,
  );
  sessionStore.on('error', (err) => console.error('[session-store]', err.message));

  app.use(
    session({
      name: config.session.name,
      secret: config.session.secret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProd,
        maxAge: config.session.maxAge,
      },
    }),
  );

  app.use(flash());

  /* ------------------------------ Contexte global ------------------------- */
  app.use(templateLocals);
  app.use(attachUser);
  app.use(csrf);

  /* --------------------------------- Limites ------------------------------ */
  // Soft: ralentit sans bloquer — puis plafond dur.
  app.use(globalSlowDown);
  app.use(globalLimiter);

  /* ---------------------------------- Routes ------------------------------ */
  app.use('/internal/cron', cronRoutes);
  app.use('/', routes);

  /* -------------------------------- Erreurs ------------------------------- */
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

/* -------------------------------------------------------------------------- */
/*  Export par défaut : instance Express.                                     */
/*  Vercel s'en sert comme application (sans app.listen).                      */
/* -------------------------------------------------------------------------- */
const app = createApp();
export default app;
