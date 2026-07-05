/**
 * transactions.test.js
 * Phase 3 tests (stock logic) — CLAUDE.md section 9, tests 1-7 and 9.
 * Requires a live PostgreSQL via TEST_DATABASE_URL; the whole suite is
 * skipped locally when unreachable (and fails hard in CI, see helpers).
 *
 * Coverage:
 *   [1] correct withdrawal   [2] negative stock prevented  [3] exact-zero boundary
 *   [4] goods receipt        [5] concurrency (the critical one)
 *   [6] atomicity (rollback) [7] undo                      [9] numeric precision
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';

import { pool } from '../src/config/db.js';
import {
  canConnectToTestDatabase,
  handleMissingTestDatabase,
  resetTestSchema,
  truncateCoreTables,
} from './helpers/database.js';
import {
  addStock,
  consumeStock,
  undoTransaction,
  TX_TYPE,
} from '../src/modules/transactions/transactions.service.js';

const dbReady = await canConnectToTestDatabase();
if (!dbReady) {
  handleMissingTestDatabase(
    'transactions.test',
    'Skipping stock suites. Provision a test database and rerun npm test.',
  );
}

/** Seeds an item with an opening balance and returns its row. */
async function seedItem(currentStock, minStock = 1) {
  const { rows } = await pool.query(
    `INSERT INTO items (name, unit, current_stock, min_stock_level)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    ['Flour', 'kg', currentStock, minStock],
  );
  return rows[0];
}

/** Seeds a user (explicit id — users.id has no default) and returns the id. */
async function seedUser(role = 'staff') {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO users (id, name, email, role) VALUES ($1, $2, $3, $4)',
    [id, 'Test User', `${id}@test.com`, role],
  );
  return id;
}

/** Reads an item's current stock as the numeric string pg returns. */
async function stockOf(itemId) {
  const { rows } = await pool.query('SELECT current_stock FROM items WHERE id = $1', [itemId]);
  return rows[0].current_stock;
}

/** Counts an item's movements of a given type. */
async function countTx(itemId, type) {
  const { rows } = await pool.query(
    'SELECT count(*)::int AS n FROM transactions WHERE item_id = $1 AND type = $2',
    [itemId, type],
  );
  return rows[0].n;
}

describe.skipIf(!dbReady)('stock logic (transactions.service)', () => {
  beforeAll(async () => {
    // Build the schema from every current migration (001, 002, ...).
    await resetTestSchema();
  });

  beforeEach(async () => {
    // Section 9: the test database is cleaned before every test.
    await truncateCoreTables();
  });

  it('[1] withdrawal decreases stock and inserts an out row', async () => {
    const user = await seedUser();
    const item = await seedItem('10');

    const { item: updated } = await consumeStock({
      itemId: item.id,
      userId: user,
      quantity: '3',
    });

    expect(updated.current_stock).toBe('7');
    expect(await countTx(item.id, TX_TYPE.OUT)).toBe(1);
  });

  it('[2] withdrawing more than the balance is rejected and stock is unchanged', async () => {
    const user = await seedUser();
    const item = await seedItem('5');

    await expect(
      consumeStock({ itemId: item.id, userId: user, quantity: '8' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });

    expect(await stockOf(item.id)).toBe('5'); // unchanged
    expect(await countTx(item.id, TX_TYPE.OUT)).toBe(0); // no movement recorded
  });

  it('[3] withdrawing exactly the balance succeeds and reaches zero', async () => {
    const user = await seedUser();
    const item = await seedItem('5');

    const { item: updated } = await consumeStock({
      itemId: item.id,
      userId: user,
      quantity: '5',
    });

    expect(updated.current_stock).toBe('0');
  });

  it('[4] receipt increases stock and inserts an in row', async () => {
    const user = await seedUser();
    const item = await seedItem('2');

    const { item: updated } = await addStock({
      itemId: item.id,
      userId: user,
      quantity: '25',
    });

    expect(updated.current_stock).toBe('27');
    expect(await countTx(item.id, TX_TYPE.IN)).toBe(1);
  });

  it('[5] two concurrent withdrawals with stock for one: exactly one succeeds', async () => {
    const user = await seedUser();
    const item = await seedItem('5');

    // Both request 5 while the balance is 5 — only one may win [INV-1].
    const results = await Promise.allSettled([
      consumeStock({ itemId: item.id, userId: user, quantity: '5' }),
      consumeStock({ itemId: item.id, userId: user, quantity: '5' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.code).toBe('INSUFFICIENT_STOCK');

    // Final balance is correct and non-negative; exactly one out movement.
    expect(await stockOf(item.id)).toBe('0');
    expect(await countTx(item.id, TX_TYPE.OUT)).toBe(1);
  });

  it('[6] a failing ledger insert rolls the balance back (atomicity)', async () => {
    const item = await seedItem('10');
    // Nonexistent user: the decrement succeeds, then the INSERT violates the
    // FK inside the same transaction [INV-2].
    const ghostUser = randomUUID();

    await expect(
      consumeStock({ itemId: item.id, userId: ghostUser, quantity: '4' }),
    ).rejects.toThrow();

    expect(await stockOf(item.id)).toBe('10'); // fully rolled back
    expect(await countTx(item.id, TX_TYPE.OUT)).toBe(0);
  });

  it('[7] undo restores the quantity via a reversal without touching the original', async () => {
    const user = await seedUser('admin');
    const item = await seedItem('10');

    const { transaction: original } = await consumeStock({
      itemId: item.id,
      userId: user,
      quantity: '3',
    });
    expect(await stockOf(item.id)).toBe('7');

    const { item: restored, transaction: reversal } = await undoTransaction({
      transactionId: original.id,
      userId: user,
    });

    // Balance restored; the reversal references the original [INV-3].
    expect(restored.current_stock).toBe('10');
    expect(reversal.reverses_transaction_id).toBe(original.id);

    // The original row is intact (no delete/update) [INV-3].
    const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1', [original.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity_change).toBe('-3');

    // The same movement cannot be undone twice.
    await expect(
      undoTransaction({ transactionId: original.id, userId: user }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('[9] fractional quantities carry no rounding errors', async () => {
    const user = await seedUser();
    const item = await seedItem('0');

    await addStock({ itemId: item.id, userId: user, quantity: '0.1' });
    await addStock({ itemId: item.id, userId: user, quantity: '0.2' });
    // 0.1 + 0.2 equals exactly 0.3 in numeric (unlike JS floats).
    expect(await stockOf(item.id)).toBe('0.3');

    await consumeStock({ itemId: item.id, userId: user, quantity: '0.2' });
    expect(await stockOf(item.id)).toBe('0.1');

    await addStock({ itemId: item.id, userId: user, quantity: '2.5' });
    expect(await stockOf(item.id)).toBe('2.6');
  });
});
