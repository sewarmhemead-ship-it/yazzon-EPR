/**
 * alerts.test.js
 * اختبارات المرحلة 4 (التنبيهات) — القسم 9 الاختبار #8، إضافةً لمنطق is_ordered (القسم 7).
 * تتطلّب قاعدة PostgreSQL حيّة عبر TEST_DATABASE_URL؛ تُتخطّى الحزمة إن تعذّر الاتصال.
 *
 * التغطية:
 *   [8] التنبيهات: الاستعلام يُرجع بالضبط العناصر current_stock <= min_stock_level.
 *   - الترتيب: is_ordered ASC ثم الأشدّ نقصاً أولاً (القسم 10).
 *   - is_ordered: يُعلَّم عند الطلب، ويعود false تلقائياً عند الاستلام (addStock) (القسم 7).
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
  handleMissingTestDatabase('alerts.test', 'تخطّي اختبارات التنبيهات.');
}

/** يزرع عنصراً ويعيد صفّه. */
async function seedItem({ name, currentStock, minStock, isOrdered = false }) {
  const { rows } = await pool.query(
    `INSERT INTO items (name, unit, current_stock, min_stock_level, is_ordered)
     VALUES ($1, 'كجم', $2, $3, $4) RETURNING *`,
    [name, currentStock, minStock, isOrdered],
  );
  return rows[0];
}

async function seedUser() {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO users (id, name, email, role) VALUES ($1, $2, $3, $4)',
    [id, 'مستخدم', `${id}@test.com`, 'admin'],
  );
  return id;
}

describe.skipIf(!dbReady)('التنبيهات (alerts)', () => {
  beforeAll(async () => {
    await resetTestSchema();
  });

  beforeEach(async () => {
    await truncateCoreTables();
  });

  it('[8] يُرجع بالضبط العناصر عند/تحت الحدّ الأدنى فقط', async () => {
    await seedItem({ name: 'تحت الحد', currentStock: '1', minStock: '5' }); // منخفض
    await seedItem({ name: 'عند الحد', currentStock: '5', minStock: '5' }); // منخفض (<=)
    await seedItem({ name: 'فوق الحد', currentStock: '9', minStock: '5' }); // ليس منخفضاً

    const items = await listAlerts();
    const names = items.map((i) => i.name);

    expect(names).toContain('تحت الحد');
    expect(names).toContain('عند الحد');
    expect(names).not.toContain('فوق الحد');
    expect(items).toHaveLength(2);
  });

  it('الترتيب: غير المطلوب قبل المطلوب، ثم الأشدّ نقصاً أولاً', async () => {
    await seedItem({ name: 'مطلوب', currentStock: '0', minStock: '5', isOrdered: true }); // نقص 5 لكنه مطلوب
    await seedItem({ name: 'نقص قليل', currentStock: '4', minStock: '5' }); // نقص 1
    await seedItem({ name: 'نقص كبير', currentStock: '1', minStock: '5' }); // نقص 4

    const items = await listAlerts();

    // is_ordered=false أولاً، وبينها الأشدّ نقصاً أولاً؛ المطلوب أخيراً.
    expect(items.map((i) => i.name)).toEqual(['نقص كبير', 'نقص قليل', 'مطلوب']);
  });

  it('markOrdered يعلّم العنصر ويضبط last_ordered_at', async () => {
    const item = await seedItem({ name: 'سكر', currentStock: '1', minStock: '5' });

    const updated = await markOrdered(item.id, true);

    expect(updated.is_ordered).toBe(true);
    expect(updated.last_ordered_at).not.toBeNull();
  });

  it('markOrdered لعنصر غير موجود → NotFound', async () => {
    await expect(markOrdered(randomUUID(), true)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('is_ordered يعود false تلقائياً عند الاستلام (addStock) — القسم 7', async () => {
    const user = await seedUser();
    const item = await seedItem({
      name: 'حليب',
      currentStock: '1',
      minStock: '5',
      isOrdered: true, // طُلب سابقاً
    });

    const { item: received } = await addStock({
      itemId: item.id,
      userId: user,
      quantity: '10',
    });

    // وصلت التوصيلة → لم يعد "مطلوباً"، والرصيد ارتفع.
    expect(received.is_ordered).toBe(false);
    expect(received.current_stock).toBe('11');
  });
});
