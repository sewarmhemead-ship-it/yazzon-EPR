/**
 * items.test.js
 * اختبارات items API. تتطلّب قاعدة PostgreSQL حيّة عبر TEST_DATABASE_URL؛ تُتخطّى إن تعذّر الاتصال.
 *
 * التغطية:
 *   - createItem يبدأ الرصيد صفراً ولا يقبل current_stock [INV-3].
 *   - listItems / getItem.
 *   - editItem تحديث جزئي لا يمسّ الرصيد [INV-3].
 *   - رفض المدخلات غير الصالحة (اسم/وحدة/حد أدنى) [INV-4][INV-6].
 *   - getItem/editItem لعنصر غير موجود → NotFound.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import {
  canConnectToTestDatabase,
  handleMissingTestDatabase,
  resetTestSchema,
  truncateCoreTables,
} from './helpers/database.js';
import { getItems, getItem, addItem, editItem } from '../src/modules/items/items.service.js';

const dbReady = await canConnectToTestDatabase();
if (!dbReady) {
  handleMissingTestDatabase('items.test', 'تخطّي اختبارات العناصر.');
}

describe.skipIf(!dbReady)('items API (items.service)', () => {
  beforeAll(async () => {
    await resetTestSchema();
  });

  beforeEach(async () => {
    await truncateCoreTables();
  });

  it('addItem: ينشئ عنصراً برصيد صفر ابتدائي [INV-3]', async () => {
    const item = await addItem({ name: 'طحين', unit: 'كجم', minStockLevel: '5' });

    expect(item.name).toBe('طحين');
    expect(item.unit).toBe('كجم');
    expect(item.current_stock).toBe('0'); // الرصيد لا يُضبط عند الإنشاء
    expect(item.min_stock_level).toBe('5');
    expect(item.is_ordered).toBe(false);
  });

  it('addItem: يستخدم الحدّ الأدنى الافتراضي 1 عند عدم تمريره', async () => {
    const item = await addItem({ name: 'ملح', unit: 'كجم' });
    expect(item.min_stock_level).toBe('1');
  });

  it('addItem: يرفض اسماً فارغاً أو وحدة فارغة [INV-6]', async () => {
    await expect(addItem({ name: '', unit: 'كجم' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(addItem({ name: 'سكر', unit: '  ' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('addItem: يرفض حدّاً أدنى غير موجب [INV-4]', async () => {
    await expect(
      addItem({ name: 'سكر', unit: 'كجم', minStockLevel: '-3' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('getItems: يعيد العناصر مرتّبة بالاسم', async () => {
    await addItem({ name: 'ياء', unit: 'كجم' });
    await addItem({ name: 'ألف', unit: 'كجم' });

    const items = await getItems();
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('ألف');
  });

  it('getItem: يعيد العنصر، ويرمي NotFound لغير الموجود', async () => {
    const created = await addItem({ name: 'حليب', unit: 'لتر' });
    const found = await getItem(created.id);
    expect(found.id).toBe(created.id);

    await expect(getItem('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('editItem: تحديث جزئي لا يمسّ current_stock [INV-3]', async () => {
    const created = await addItem({ name: 'زبدة', unit: 'كجم', minStockLevel: '2' });

    const updated = await editItem(created.id, { minStockLevel: '4' });
    expect(updated.min_stock_level).toBe('4');
    expect(updated.name).toBe('زبدة'); // لم يتغيّر
    expect(updated.current_stock).toBe('0'); // الرصيد لم يُمَس
  });

  it('editItem: يرمي NotFound لعنصر غير موجود', async () => {
    await expect(
      editItem('00000000-0000-0000-0000-000000000000', { name: 'س' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
