/**
 * withTransaction.js
 * Layer: shared — wraps an operation in a single database transaction.
 * Enforces [INV-2]: every stock movement is one transaction — the balance
 * update and the ledger insert succeed together or roll back together.
 *
 * Usage: run every statement on the client passed to the callback so it stays
 * inside the transaction. Anything sent to the pool directly escapes it.
 */

import { getClient } from '../config/db.js';

/**
 * Executes the callback inside BEGIN/COMMIT, rolls back on any error, and
 * always releases the client (preventing pool exhaustion).
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 *   Receives the checked-out client and must run all queries on it.
 * @returns {Promise<T>} The callback's result after a successful COMMIT.
 * @throws Rethrows the callback's error after ROLLBACK.
 */
export async function withTransaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // Discard partial changes so balance and ledger never end up half-written [INV-2].
    await client.query('ROLLBACK');
    throw err; // Propagate to the central errorHandler (section 6, rule 5).
  } finally {
    client.release();
  }
}
