import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import methodOverride from 'method-override';
import helmet from 'helmet';
import flash from 'connect-flash';

import config, { PUBLIC_DIR } from './config/env.js';
import { configureViews, assertViewsPresent } from './config/twig.js';
import routes from './routes/index.js';
import { attachUser } from './middlewares/auth.js';
import { csrf } from './middlewares/csrf.js';
import { templateLocals } from './middlewares/locals.js';
import { globalLimiter } from './middlewares/rateLimit.js';
import { notFound, errorHandler } from './middlewares/errors.js';

export function createApp() {
  const app = express();

  assertViewsPresent();
  configureViews(app);

  if (config.isProd) app.set('trust proxy', 1);

  /* ------------------------------- Sécurité ------------------------------- */
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
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  /* -------------------------------- Parsing ------------------------------- */
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(methodOverride('_method'));

  /* ------------------------------ Fichiers statiques ---------------------- */
  app.use(
    express.static(PUBLIC_DIR, {
      maxAge: config.isProd ? '7d' : 0,
      etag: true,
    }),
  );

  /* --------------------------------- Session ------------------------------ */
  const MySQLStore = MySQLStoreFactory(session);
  const sessionStore = new MySQLStore({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 1000 * 60 * 15,
    expiration: config.session.maxAge,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data',
      },
    },
  });
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
  app.use(globalLimiter);

  /* ---------------------------------- Routes ------------------------------ */
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
