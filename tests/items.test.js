/**
 * items.test.js
 * items API tests. Requires a live PostgreSQL via TEST_DATABASE_URL; skipped
 * locally when unreachable.
 *
 * Coverage:
 *   - createItem starts stock at zero and never accepts current_stock [INV-3].
 *   - listItems / getItem.
 *   - editItem partial updates never touch the balance [INV-3].
 *   - invalid input rejected (name/unit/threshold) [INV-4][INV-6].
 *   - getItem/editItem on a missing item throw NotFound.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import {
  canConnectToTestDatabase,
  handleMissingTestDatabase,
  resetTestSchema,
  truncateCoreTables,
} from './helpers/database.js';
import { pool } from '../src/config/db.js';
import { getItems, getItem, addItem, editItem } from '../src/modules/items/items.service.js';

const dbReady = await canConnectToTestDatabase();
if (!dbReady) {
  handleMissingTestDatabase('items.test', 'Skipping item suites.');
}

describe.skipIf(!dbReady)('items API (items.service)', () => {
  beforeAll(async () => {
    await resetTestSchema();
  });

  beforeEach(async () => {
    await truncateCoreTables();
  });

  it('addItem creates an item with zero opening stock [INV-3]', async () => {
    const item = await addItem({ name: 'Flour', unit: 'kg', minStockLevel: '5' });

    expect(item.name).toBe('Flour');
    expect(item.unit).toBe('kg');
    expect(item.current_stock).toBe('0'); // stock is never set on creation
    expect(item.min_stock_level).toBe('5');
    expect(item.is_ordered).toBe(false);
  });

  it('addItem falls back to the default minimum of 1', async () => {
    const item = await addItem({ name: 'Salt', unit: 'kg' });
    expect(item.min_stock_level).toBe('1');
  });

  it('addItem rejects an empty name or unit [INV-6]', async () => {
    await expect(addItem({ name: '', unit: 'kg' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(addItem({ name: 'Sugar', unit: '  ' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('addItem rejects a non-positive minimum [INV-4]', async () => {
    await expect(
      addItem({ name: 'Sugar', unit: 'kg', minStockLevel: '-3' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('getItems returns items sorted by name', async () => {
    await addItem({ name: 'Zucker', unit: 'kg' });
    await addItem({ name: 'Butter', unit: 'kg' });

    const items = await getItems();
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('Butter');
  });

  it('getItem returns the item and throws NotFound for a missing id', async () => {
    const created = await addItem({ name: 'Milk', unit: 'L' });
    const found = await getItem(created.id);
    expect(found.id).toBe(created.id);

    await expect(getItem('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('editItem applies a partial update without touching current_stock [INV-3]', async () => {
    const created = await addItem({ name: 'Butter', unit: 'kg', minStockLevel: '2' });

    const updated = await editItem(created.id, { minStockLevel: '4' });
    expect(updated.min_stock_level).toBe('4');
    expect(updated.name).toBe('Butter'); // unchanged
    expect(updated.current_stock).toBe('0'); // balance untouched
  });

  it('editItem can clear nullable metadata without touching current_stock [INV-3]', async () => {
    const { rows: categoryRows } = await pool.query(
      "INSERT INTO categories (name) VALUES ('Dairy') RETURNING id",
    );
    const { rows: locationRows } = await pool.query(
      "INSERT INTO locations (name, position) VALUES ('Fridge 1', 1) RETURNING id",
    );
    const created = await addItem({
      name: 'Milk',
      unit: 'L',
      categoryId: categoryRows[0].id,
      locationId: locationRows[0].id,
    });

    const updated = await editItem(created.id, { categoryId: null, locationId: null });

    expect(updated.category_id).toBeNull();
    expect(updated.location_id).toBeNull();
    expect(updated.current_stock).toBe('0');
  });

  it('editItem throws NotFound for a missing item', async () => {
    await expect(
      editItem('00000000-0000-0000-0000-000000000000', { name: 'x' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
