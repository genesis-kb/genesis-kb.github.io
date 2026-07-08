/**
 * Shared Database Connection Pool
 * Single pool instance shared across all services (transcripts, audiobooks, etc.)
 * Avoids duplicating connections to the same PostgreSQL instance.
 */

import pg from 'pg';
import config from '../config/index.js';
import logger from '../config/logger.js';

const { Pool } = pg;

let pool = null;

/**
 * Get or create the shared connection pool.
 * All services that talk to the same PostgreSQL instance should use this.
 */
export const getPool = () => {
  if (!pool) {
    if (!config.database.url) {
      logger.error('DATABASE_URL is missing. Please check your .env file.');
      throw new Error('DATABASE_URL configuration is missing');
    }

    pool = new Pool({
      connectionString: config.database.url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: config.server.isProduction
        ? { rejectUnauthorized: config.database.rejectUnauthorized }
        : false,
      options: '-c statement_timeout=10000',
    });

    pool.on('error', (err) => {
      logger.error('Unexpected pool error:', { error: err.message });
    });

    logger.info('Shared PostgreSQL connection pool initialized');
  }

  return pool;
};

/**
 * Execute a query with timeout using the shared pool.
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 */
export const query = async (text, params = []) => {
  const startedAt = Date.now();
  try {
    const pool = getPool();
    const result = await pool.query(text, params);
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 1000) {
      logger.info('Slow database query completed', {
        durationMs,
        rowCount: result.rowCount,
      });
    }
    return result;
  } catch (error) {
    logger.error('Database query failed', { error: error.message });
    throw error;
  }
};

export default { getPool, query };
