import mysql from 'mysql2/promise';
import config from './env.js';

/**
 * Pool de connexions MySQL partagé.
 * Toutes les requêtes applicatives passent par ce pool (prepared statements).
 */
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  dateStrings: false,
  namedPlaceholders: false,
});

/**
 * Exécute une requête paramétrée et retourne les lignes.
 * @param {string} sql
 * @param {Array|Object} params
 */
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Retourne la première ligne ou null. */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

/** Exécute une requête d'écriture et retourne le résultat (insertId, affectedRows). */
export async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

/**
 * Encapsule plusieurs écritures dans une transaction.
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<any>} fn
 */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Vérifie que la base est joignable (health check / démarrage). */
export async function pingDatabase() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

export default pool;
