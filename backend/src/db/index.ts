import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import logger from '../utils/logger';

let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export function initializeDatabase(): Pool {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString: config.database.url,
    min: config.database.poolMin,
    max: config.database.poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('connect', () => {
    logger.debug('New database connection established');
  });

  pool.on('error', (err) => {
    logger.error('Unexpected database pool error', { error: err });
  });

  logger.info('Database pool initialized');

  return pool;
}

/**
 * Get database pool instance
 */
export function getDb(): Pool {
  if (!pool) {
    return initializeDatabase();
  }
  return pool;
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

/**
 * Execute a query with automatic connection handling
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const db = getDb();
  const start = Date.now();

  try {
    const result = await db.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      duration,
      rowCount: result.rowCount,
      query: text.substring(0, 100),
    });

    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  } catch (error) {
    logger.error('Query error', {
      error,
      query: text.substring(0, 100),
      params,
    });
    throw error;
  }
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', { error });
    throw error;
  } finally {
    client.release();
  }
}

export default {
  initialize: initializeDatabase,
  getDb,
  close: closeDatabase,
  query,
  transaction,
};
