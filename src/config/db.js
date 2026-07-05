/**
 * db.js
 * Layer: config — the node-postgres (pg) connection pool is the only entry
 * point to the database. No business logic here.
 *
 * Hard rules (CLAUDE.md section 2):
 *   - All data access goes through pg. supabase-js is forbidden in backend code.
 *   - Every statement is hand-written and parameterized ($1, $2, ...) — never
 *     interpolate values into SQL text.
 */

import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

/**
 * Shared connection pool for the whole application. Reusing connections is
 * cheaper and safer than opening one per request, and a dedicated client from
 * this pool is what makes atomic transactions possible [INV-2].
 */
export let pool = new Pool({ connectionString: env.databaseUrl });

// Surface idle-connection errors instead of swallowing them (section 6, rule 5).
pool.on('error', (err) => {
  console.error('[db] unexpected error on idle pool connection:', err);
});

/**
 * Replaces the active pool. Test/demo seam only (e.g. the in-memory pg-mem
 * pool used by scripts/demo.js) — production code must never call this.
 * @param {import('pg').Pool} newPool
 */
export function setPool(newPool) {
  pool = newPool;
}

/**
 * Runs a single parameterized query on the pool. For one-off statements only;
 * multi-step transactions must use withTransaction (getClient).
 * @param {string} text SQL with positional parameters ($1, $2, ...).
 * @param {unknown[]} [params] Parameter values in order.
 * @returns {Promise<import('pg').QueryResult>}
 */
export function query(text, params) {
  return pool.query(text, params);
}

/**
 * Checks out a dedicated client for a multi-step transaction.
 * The caller must always release it (withTransaction takes care of that). [INV-2]
 * @returns {Promise<import('pg').PoolClient>}
 */
export function getClient() {
  return pool.connect();
}
