/**
 * categories.test.js
 * categories API tests. Requires a live PostgreSQL via TEST_DATABASE_URL;
 * skipped locally when unreachable.
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
  handleMissingTestDatabase('categories.test', 'Skipping category suites.');
}

describe.skipIf(!dbReady)('categories API', () => {
  beforeAll(async () => {
    await resetTestSchema();
  });

  beforeEach(async () => {
    await truncateCoreTables();
  });

  it('addCategory creates and returns a category', async () => {
    const cat = await addCategory('Käse');
    expect(cat.name).toBe('Käse');
    expect(cat.id).toBeTruthy();
  });

  it('addCategory rejects an empty name', async () => {
    await expect(addCategory('  ')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('getCategories returns categories sorted by name', async () => {
    await addCategory('Saucen');
    await addCategory('Brot & Gebäck');
    const cats = await getCategories();
    expect(cats.map((c) => c.name)).toEqual(['Brot & Gebäck', 'Saucen']);
  });
});
