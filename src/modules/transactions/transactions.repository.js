/**
 * transactions.repository.js
 * Layer: repository — SQL for stock movements only. No business logic.
 * SQL-level enforcement of: [INV-1] no negative stock (conditional atomic
 * UPDATE), [INV-3] immutable ledger (INSERT only).
 *
 * Write functions take a transaction `client` so they run inside the wrapping
 * transaction [INV-2]; plain reads (movement history) use the pool directly.
 * All SQL is hand-written and parameterized via node-postgres (section 2).
 */

import { query } from '../../config/db.js';

/**
 * Decrements an item's stock by a positive amount, atomically, only when
 * enough stock exists.
 *
 * [INV-1] This is a single conditional atomic UPDATE. Never split it into
 * SELECT-then-UPDATE: the `current_stock >= $qty` guard inside the statement
 * is what prevents the race between two concurrent withdrawals.
 * Zero rows returned = insufficient stock (the service turns it into a 409).
 * @param {import('pg').PoolClient} client Transaction client.
 * @param {string} itemId Item id.
 * @param {string|number} quantity Positive amount to withdraw.
 * @returns {Promise<object | null>} Updated row, or null when stock was insufficient.
 */
export async function decrementStock(client, itemId, quantity) {
  const { rows } = await client.query(
    `UPDATE items SET current_stock = current_stock - $1
     WHERE id = $2 AND current_stock >= $1
     RETURNING *`,
    [quantity, itemId],
  );
  return rows[0] ?? null;
}

/**
 * Increments an item's stock by a positive amount (goods receipt — the "in"
 * movement only). No stock guard needed since additions cannot go negative.
 * Also resets is_ordered to false because a receipt means the delivery
 * arrived (section 7); adjustments/undo use applyStockDelta and leave the
 * flag untouched.
 * @param {import('pg').PoolClient} client Transaction client.
 * @param {string} itemId Item id.
 * @param {string|number} quantity Positive amount to add.
 * @returns {Promise<object | null>} Updated row, or null when the item does not exist.
 */
export async function incrementStock(client, itemId, quantity) {
  const { rows } = await client.query(
    `UPDATE items SET current_stock = current_stock + $1, is_ordered = false
     WHERE id = $2
     RETURNING *`,
    [quantity, itemId],
  );
  return rows[0] ?? null;
}

/**
 * Applies a signed delta to the stock atomically while preventing it from
 * going below zero [INV-1]. Used for adjustments (which may be positive or
 * negative); the `current_stock + $delta >= 0` guard covers negative deltas.
 * @param {import('pg').PoolClient} client Transaction client.
 * @param {string} itemId Item id.
 * @param {string|number} delta Signed difference (+/-).
 * @returns {Promise<object | null>} Updated row, or null when the result would
 *   be negative or the item does not exist.
 */
export async function applyStockDelta(client, itemId, delta) {
  const { rows } = await client.query(
    `UPDATE items SET current_stock = current_stock + $1
     WHERE id = $2 AND current_stock + $1 >= 0
     RETURNING *`,
    [delta, itemId],
  );
  return rows[0] ?? null;
}

/**
 * Inserts a row into the immutable ledger [INV-3]. INSERT only — never
 * UPDATE/DELETE. created_at is left to the server default (now()) for a
 * trustworthy chronological order.
 * @param {import('pg').PoolClient} client Transaction client.
 * @param {object} tx Movement data.
 * @param {string} tx.itemId
 * @param {string} tx.userId
 * @param {'in'|'out'|'waste'|'adjustment'} tx.type
 * @param {string|number} tx.quantityChange Positive = inflow, negative = outflow.
 * @param {string|null} [tx.note]
 * @param {string|null} [tx.reversesTransactionId] Original movement when reversing.
 * @returns {Promise<object>} The inserted row.
 */
export async function insertTransaction(client, tx) {
  const { rows } = await client.query(
    `INSERT INTO transactions
       (item_id, user_id, type, quantity_change, note, reverses_transaction_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      tx.itemId,
      tx.userId,
      tx.type,
      tx.quantityChange,
      tx.note ?? null,
      tx.reversesTransactionId ?? null,
    ],
  );
  return rows[0];
}

/**
 * Fetches a movement by id (pre-undo check). Read only.
 * @param {import('pg').PoolClient} client Transaction client.
 * @param {string} transactionId
 * @returns {Promise<object | null>}
 */
export async function findTransactionById(client, transactionId) {
  const { rows } = await client.query(
    'SELECT * FROM transactions WHERE id = $1',
    [transactionId],
  );
  return rows[0] ?? null;
}

/**
 * Checks whether a movement was already reversed (prevents double undo) [INV-3].
 * @param {import('pg').PoolClient} client Transaction client.
 * @param {string} transactionId Original movement id.
 * @returns {Promise<boolean>} True when a reversal references it.
 */
export async function hasReversal(client, transactionId) {
  const { rows } = await client.query(
    'SELECT 1 FROM transactions WHERE reverses_transaction_id = $1 LIMIT 1',
    [transactionId],
  );
  return rows.length > 0;
}

/**
 * Reads the movement history (newest first) with item, user, and location
 * names joined — a read-only view of the immutable ledger [INV-3].
 * Filters are optional; the WHERE clause is assembled dynamically but every
 * value stays parameterized.
 * @param {object} filters
 * @param {string|null} [filters.itemId] Restrict to one item.
 * @param {string|null} [filters.locationId] Restrict to one location (fridge).
 * @param {string|null} [filters.type] Restrict to in|out|waste|adjustment.
 * @param {number} [filters.limit] Maximum rows (default 50).
 * @returns {Promise<object[]>}
 */
export async function listTransactions({ itemId, locationId, type, limit = 50 } = {}) {
  const conditions = [];
  const params = [];
  if (itemId) {
    params.push(itemId);
    conditions.push(`t.item_id = $${params.length}`);
  }
  if (locationId) {
    params.push(locationId);
    conditions.push(`i.location_id = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`t.type = $${params.length}`);
  }
  params.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT t.id, t.type, t.quantity_change, t.note, t.created_at,
            t.reverses_transaction_id, t.item_id,
            EXISTS (
              SELECT 1 FROM transactions r
              WHERE r.reverses_transaction_id = t.id
            ) AS is_reversed,
            i.name AS item_name, i.unit,
            u.name AS user_name,
            l.name AS location_name
     FROM transactions t
     JOIN items i ON i.id = t.item_id
     JOIN users u ON u.id = t.user_id
     LEFT JOIN locations l ON l.id = i.location_id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}
