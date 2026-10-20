/**
 * Crée la base de données (si besoin) puis applique le schéma.
 * Usage : npm run db:setup
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import config from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Découpe un fichier SQL en instructions exécutables. */
export function splitStatements(sql) {
  return sql
    .split(';')
    .map((chunk) =>
      chunk
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((chunk) => chunk.length > 0);
}

/**
 * Migrations idempotentes : ajoute des colonnes/index manquants sur une base
 * déjà créée (le schéma utilise CREATE TABLE IF NOT EXISTS et ne modifie donc
 * jamais une table existante).
 */
const COLUMN_MIGRATIONS = [
  {
    table: 'users',
    column: 'must_change_password',
    ddl: 'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active',
  },
  {
    table: 'access_requests',
    column: 'uuid',
    ddl: 'ALTER TABLE access_requests ADD COLUMN uuid CHAR(36) NULL AFTER message',
  },
  {
    table: 'access_requests',
    column: 'approved_at',
    ddl: 'ALTER TABLE access_requests ADD COLUMN approved_at DATETIME NULL AFTER status',
  },
  {
    table: 'access_requests',
    column: 'athlete_id',
    ddl: 'ALTER TABLE access_requests ADD COLUMN athlete_id INT UNSIGNED NULL AFTER approved_at',
  },
  {
    table: 'programs',
    column: 'sessions_per_week',
    ddl: 'ALTER TABLE programs ADD COLUMN sessions_per_week TINYINT UNSIGNED NOT NULL DEFAULT 3 AFTER weeks',
  },
  {
    table: 'program_days',
    column: 'session_type',
    ddl: "ALTER TABLE program_days ADD COLUMN session_type ENUM('full_body','body_part') NOT NULL DEFAULT 'full_body' AFTER focus",
  },
  {
    table: 'program_days',
    column: 'scheduled_time',
    ddl: "ALTER TABLE program_days ADD COLUMN scheduled_time TIME NOT NULL DEFAULT '18:00:00' AFTER session_type",
  },
];

const INDEX_MIGRATIONS = [
  {
    table: 'access_requests',
    index: 'uq_requests_uuid',
    ddl: 'ALTER TABLE access_requests ADD UNIQUE KEY uq_requests_uuid (uuid)',
  },
  {
    table: 'access_requests',
    index: 'idx_requests_athlete',
    ddl: 'ALTER TABLE access_requests ADD KEY idx_requests_athlete (athlete_id)',
  },
];

const TABLE_MIGRATIONS = [
  {
    table: 'photo_sessions',
    ddl: `CREATE TABLE IF NOT EXISTS photo_sessions (
      id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
      athlete_id      INT UNSIGNED NOT NULL,
      session_date    DATE NOT NULL,
      notes           TEXT NULL,
      created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sessions_athlete_date (athlete_id, session_date),
      CONSTRAINT fk_session_athlete FOREIGN KEY (athlete_id) REFERENCES athletes (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    table: 'session_photos',
    ddl: `CREATE TABLE IF NOT EXISTS session_photos (
      id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
      session_id      INT UNSIGNED NOT NULL,
      view_key        ENUM('devant','dos','profil_gauche','profil_droit','complementaire') NOT NULL,
      image_url       VARCHAR(500) NOT NULL,
      image_public_id VARCHAR(255) NULL,
      mime_type       VARCHAR(60) NOT NULL,
      file_size       INT UNSIGNED NOT NULL,
      created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_session_view (session_id, view_key),
      KEY idx_photos_session (session_id),
      CONSTRAINT fk_photo_session FOREIGN KEY (session_id) REFERENCES photo_sessions (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    table: 'photo_comments',
    ddl: `CREATE TABLE IF NOT EXISTS photo_comments (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      session_id  INT UNSIGNED NOT NULL,
      author_id   INT UNSIGNED NOT NULL,
      content     TEXT NOT NULL,
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_comments_session (session_id),
      CONSTRAINT fk_comment_session FOREIGN KEY (session_id) REFERENCES photo_sessions (id) ON DELETE CASCADE,
      CONSTRAINT fk_comment_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    table: 'photo_reports',
    ddl: `CREATE TABLE IF NOT EXISTS photo_reports (
      id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
      session_id   INT UNSIGNED NOT NULL,
      athlete_id   INT UNSIGNED NOT NULL,
      author_id    INT UNSIGNED NOT NULL,
      content      TEXT NOT NULL,
      status       ENUM('draft','validated') NOT NULL DEFAULT 'draft',
      validated_at DATETIME NULL,
      sent_at      DATETIME NULL,
      created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_report_session (session_id),
      KEY idx_reports_athlete (athlete_id, validated_at),
      CONSTRAINT fk_report_session FOREIGN KEY (session_id) REFERENCES photo_sessions (id) ON DELETE CASCADE,
      CONSTRAINT fk_report_athlete FOREIGN KEY (athlete_id) REFERENCES athletes (id) ON DELETE CASCADE,
      CONSTRAINT fk_report_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    table: 'session_reminders',
    ddl: `CREATE TABLE IF NOT EXISTS session_reminders (
      id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
      program_day_id  INT UNSIGNED NOT NULL,
      athlete_id      INT UNSIGNED NOT NULL,
      session_date    DATE NOT NULL,
      reminded_at     DATETIME NOT NULL,
      created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_reminder_day_date (program_day_id, session_date),
      KEY idx_reminders_athlete (athlete_id, session_date),
      CONSTRAINT fk_reminders_day FOREIGN KEY (program_day_id) REFERENCES program_days (id) ON DELETE CASCADE,
      CONSTRAINT fk_reminders_athlete FOREIGN KEY (athlete_id) REFERENCES athletes (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
];

async function tableExists(conn, database, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [database, table],
  );
  return rows.length > 0;
}

async function columnExists(conn, database, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [database, table, column],
  );
  return rows.length > 0;
}

async function indexExists(conn, database, table, index) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [database, table, index],
  );
  return rows.length > 0;
}

export async function migrate(conn) {
  const db = config.db.database;
  let applied = 0;
  for (const m of COLUMN_MIGRATIONS) {
    // Lit les colonnes une à une (cache d'information_schema possible, on relit).
    if (!(await columnExists(conn, db, m.table, m.column))) {
      await conn.query(m.ddl);
      applied += 1;
    }
  }
  for (const m of INDEX_MIGRATIONS) {
    if (!(await indexExists(conn, db, m.table, m.index))) {
      try {
        await conn.query(m.ddl);
        applied += 1;
      } catch (err) {
        // Index déjà présent sous un autre nom : on ignore.
        if (err.code !== 'ER_DUP_KEYNAME') throw err;
      }
    }
  }
  for (const m of TABLE_MIGRATIONS) {
    if (!(await tableExists(conn, db, m.table))) {
      await conn.query(m.ddl);
      applied += 1;
    }
  }
  return applied;
}

export async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = splitStatements(sql);

  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: false,
    charset: 'utf8mb4_unicode_ci',
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await conn.changeUser({ database: config.db.database });

    for (const statement of statements) {
      await conn.query(statement);
    }

    // Applique les colonnes/index manquants (bases existantes).
    const migrated = await migrate(conn);
    return { statements: statements.length, migrated };
  } finally {
    await conn.end();
  }
}

// Exécution directe
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runSchema()
    .then(({ statements, migrated }) => {
      console.log(
        `[db:setup] Base "${config.db.database}" prête (${statements} instructions, ${migrated} migration(s)).`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error('[db:setup] Échec :', err.message);
      process.exit(1);
    });
}
