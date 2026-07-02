/**
 * categories.test.js
 * اختبارات categories API. تتطلّب قاعدة PostgreSQL حيّة عبر TEST_DATABASE_URL؛ تُتخطّى إن تعذّر.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import {
  canConnectToTestDatabase,
  handleMissingTestDatabase,
  resetTestSchema,
  truncateCoreTables,
} from './helpers/database.js';
import { getCategories, addCategory } from '../src/modules/categories/categories.service.js';

const dbReady = await canConnectToTestDatabase();
if (!dbReady) {
  handleMissingTestDatabase('categories.test', 'تخطّي اختبارات التصنيفات.');
}

describe.skipIf(!dbReady)('categories API', () => {
  beforeAll(async () => {
    await resetTestSchema();
  });

  beforeEach(async () => {
    await truncateCoreTables();
  });

  it('addCategory: ينشئ تصنيفاً ويعيده', async () => {
    const cat = await addCategory('Käse');
    expect(cat.name).toBe('Käse');
    expect(cat.id).toBeTruthy();
  });

  it('addCategory: يرفض اسماً فارغاً', async () => {
    await expect(addCategory('  ')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('getCategories: يعيد التصنيفات مرتّبة بالاسم', async () => {
    await addCategory('Saucen');
    await addCategory('Brot & Gebäck');
    const cats = await getCategories();
    expect(cats.map((c) => c.name)).toEqual(['Brot & Gebäck', 'Saucen']);
  });
});
