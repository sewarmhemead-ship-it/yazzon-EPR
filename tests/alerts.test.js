/**
 * alerts.test.js
 * Phase 4 tests (alerts) — section 9 test 8, plus the is_ordered lifecycle
 * (section 7). Requires a live PostgreSQL via TEST_DATABASE_URL; skipped
 * locally when unreachable.
 *
 * Coverage:
 *   [8] the query returns exactly the items with current_stock <= min_stock_level.
 *   - Ordering: is_ordered ASC, then largest shortfall first (section 10).
 *   - is_ordered: set when ordering, reset automatically on receipt (addStock).
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
import { listAlerts, markOrdered } from '../src/modules/alerts/alerts.service.js';
import { addStock } from '../src/modules/transactions/transactions.service.js';

const dbReady = await canConnectToTestDatabase();
if (!dbReady) {
  handleMissingTestDatabase('alerts.test', 'Skipping alert suites.');
}

/** Seeds an item and returns its row. */
async function seedItem({ name, currentStock, minStock, isOrdered = false }) {
  const { rows } = await pool.query(
    `INSERT INTO items (name, unit, current_stock, min_stock_level, is_ordered)
     VALUES ($1, 'kg', $2, $3, $4) RETURNING *`,
    [name, currentStock, minStock, isOrdered],
  );
  return rows[0];
}

async function seedUser() {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO users (id, name, email, role) VALUES ($1, $2, $3, $4)',
    [id, 'Test User', `${id}@test.com`, 'admin'],
  );
  return id;
}

describe.skipIf(!dbReady)('alerts', () => {
  beforeAll(async () => {
    await resetTestSchema();
  });

  beforeEach(async () => {
    await truncateCoreTables();
  });

  it('[8] returns exactly the items at or below their minimum', async () => {
    await seedItem({ name: 'below-min', currentStock: '1', minStock: '5' }); // low
    await seedItem({ name: 'at-min', currentStock: '5', minStock: '5' }); // low (<=)
    await seedItem({ name: 'above-min', currentStock: '9', minStock: '5' }); // fine

    const items = await listAlerts();
    const names = items.map((i) => i.name);

    expect(names).toContain('below-min');
    expect(names).toContain('at-min');
    expect(names).not.toContain('above-min');
    expect(items).toHaveLength(2);
  });

  it('orders unordered before ordered, then largest shortfall first', async () => {
    await seedItem({ name: 'ordered', currentStock: '0', minStock: '5', isOrdered: true }); // shortfall 5 but ordered
    await seedItem({ name: 'small-shortfall', currentStock: '4', minStock: '5' }); // shortfall 1
    await seedItem({ name: 'big-shortfall', currentStock: '1', minStock: '5' }); // shortfall 4

    const items = await listAlerts();

    // is_ordered=false first, largest shortfall first among them; ordered last.
    expect(items.map((i) => i.name)).toEqual(['big-shortfall', 'small-shortfall', 'ordered']);
  });

  it('markOrdered sets the flag and stamps last_ordered_at', async () => {
    const item = await seedItem({ name: 'sugar', currentStock: '1', minStock: '5' });

    const updated = await markOrdered(item.id, true);

    expect(updated.is_ordered).toBe(true);
    expect(updated.last_ordered_at).not.toBeNull();
  });

  it('markOrdered on a missing item throws NotFound', async () => {
    await expect(markOrdered(randomUUID(), true)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('is_ordered resets automatically on receipt (addStock) — section 7', async () => {
    const user = await seedUser();
    const item = await seedItem({
      name: 'milk',
      currentStock: '1',
      minStock: '5',
      isOrdered: true, // previously ordered
    });

    const { item: received } = await addStock({
      itemId: item.id,
      userId: user,
      quantity: '10',
    });

    // The delivery arrived: no longer "ordered", balance increased.
    expect(received.is_ordered).toBe(false);
    expect(received.current_stock).toBe('11');
  });
});
