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
