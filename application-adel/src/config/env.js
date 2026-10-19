import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Racine du projet : application-adel/
export const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const VIEWS_DIR = path.join(ROOT_DIR, 'views');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const EXERCISE_MEDIA_DIR = path.join(ROOT_DIR, 'storage', 'exercises', 'media');

// Charge le .env situé à la racine du projet.
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const bool = (v, fallback = false) =>
  v === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

const int = (v, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
};

/** URL publique : jamais localhost en prod (liens e-mails, canonical, sitemap). */
function resolveAppUrl(port) {
  const raw = String(process.env.APP_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (raw && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw)) {
    return raw;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${String(process.env.VERCEL_PROJECT_PRODUCTION_URL).replace(/\/$/, '')}`;
  }
  if ((process.env.NODE_ENV || 'development') === 'production') {
    return 'https://adelcoaching.com';
  }
  return `http://localhost:${port}`;
}

const port = int(process.env.PORT, 3000);

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port,
  appUrl: resolveAppUrl(port),
  appName: process.env.APP_NAME || 'Coach Adel',

  session: {
    secret: process.env.SESSION_SECRET || 'change-me-super-secret',
    name: 'adel.sid',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
  },

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: int(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'adel_app',
    // AlwaysData limite souvent max_user_connections (~5–15). Sur Vercel,
    // chaque instance froide ouvre un pool : rester très bas.
    connectionLimit: int(process.env.DB_CONNECTION_LIMIT, 2),
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'coach-adel',
    get enabled() {
      return Boolean(this.cloudName && this.apiKey && this.apiSecret);
    },
  },

  mail: {
    host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
    port: int(process.env.BREVO_SMTP_PORT, 587),
    user: process.env.BREVO_SMTP_USER || '',
    password: process.env.BREVO_SMTP_PASSWORD || '',
    fromEmail: process.env.MAIL_FROM_EMAIL || 'annabelle.adel300@gmail.com',
    fromName: process.env.MAIL_FROM_NAME || 'Coach Adel',
    get enabled() {
      return Boolean(this.user && this.password);
    },
  },

  seed: {
    adminName: process.env.ADMIN_NAME || 'Adel',
    adminEmail: process.env.ADMIN_EMAIL || 'annabelle.adel300@gmail.com',
    adminPassword: process.env.ADMIN_PASSWORD || 'change-me-admin-password',
  },

  uploads: {
    maxFileSize: 8 * 1024 * 1024, // 8 Mo
    allowedMime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
  },

  /** Fuseau pour les rappels de séance (heure locale coach / sportif). */
  timezone: process.env.APP_TIMEZONE || 'Europe/Paris',

  cors: {
    origins: String(process.env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  cron: {
    /** Secret Bearer / ?secret= pour /internal/cron/* (Vercel Cron + crontab). */
    secret: process.env.CRON_SECRET || '',
  },
};

export default config;
