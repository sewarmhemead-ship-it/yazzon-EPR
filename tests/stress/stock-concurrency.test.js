/**
 * stock-concurrency.test.js
 * طبقة الاختبار: stress — ضغط تزامن على أخطر invariant في النظام.
 * يثبت أن المشروع لا "ينهار" عند 100 سحب متوازٍ من نفس العنصر: [INV-1] يبقى الرصيد غير سالب.
 */

import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';

import { pool } from '../../src/config/db.js';
import { consumeStock } from '../../src/modules/transactions/transactions.service.js';
import {
  canConnectToTestDatabase,
  handleMissingTestDatabase,
  resetTestSchema,
  truncateCoreTables,
} from '../helpers/database.js';

const dbReady = await canConnectToTestDatabase();
if (!dbReady) {
  handleMissingTestDatabase('stress', 'تخطّي اختبار الضغط.');
}

async function seedUser() {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO users (id, name, email, role) VALUES ($1, $2, $3, $4)',
    [id, 'Stress User', `${id}@stress.local`, 'staff'],
  );
  return id;
}

async function seedItem(currentStock) {
  const { rows } = await pool.query(
    `INSERT INTO items (name, unit, current_stock, min_stock_level)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    ['Stress Gouda', 'kg', currentStock, '1'],
  );
  return rows[0];
}

async function stockAndOutCount(itemId) {
  const { rows } = await pool.query(
    `SELECT i.current_stock,
            count(t.id)::int AS out_count
     FROM items i
     LEFT JOIN transactions t ON t.item_id = i.id AND t.type = 'out'
     WHERE i.id = $1
     GROUP BY i.id`,
    [itemId],
  );
  return rows[0];
}

describe.skipIf(!dbReady)('stress: concurrent stock consumption', () => {
  beforeAll(async () => {
    await resetTestSchema();
  });

  beforeEach(async () => {
    await truncateCoreTables();
  });

  it('100 سحب متوازٍ على رصيد 50 لا ينتج رصيداً سالباً ولا أكثر من 50 حركة', async () => {
    const userId = await seedUser();
    const item = await seedItem('50');

    const results = await Promise.allSettled(
      Array.from({ length: 100 }, () =>
        consumeStock({
          itemId: item.id,
          userId,
          quantity: '1',
        }),
      ),
    );

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    const insufficient = rejected.filter(
      (result) => result.reason?.code === 'INSUFFICIENT_STOCK',
    );
    const final = await stockAndOutCount(item.id);

    expect(fulfilled).toHaveLength(50);
    expect(rejected).toHaveLength(50);
    expect(insufficient).toHaveLength(50);
    expect(final.current_stock).toBe('0');
    expect(final.out_count).toBe(50);
  });
});
