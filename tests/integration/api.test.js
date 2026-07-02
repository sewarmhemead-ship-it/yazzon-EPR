/**
 * api.test.js
 * طبقة الاختبار: integration — Express route → controller → service → repository → DB.
 * يفحص تدفقاً واقعياً قبل الرفع: تصنيف + براد + عنصر + حركات + سجل.
 */

import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import {
  canConnectToTestDatabase,
  handleMissingTestDatabase,
  resetTestSchema,
  truncateCoreTables,
} from '../helpers/database.js';

const dbReady = await canConnectToTestDatabase();
if (!dbReady) {
  handleMissingTestDatabase('api.integration', 'تخطّي اختبارات API integration.');
}

async function seedUser(role) {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO users (id, name, email, role) VALUES ($1, $2, $3, $4)',
    [id, role === 'admin' ? 'Admin Test' : 'Staff Test', `${id}@test.local`, role],
  );
  return { id, role };
}

function tokenFor(user) {
  return jwt.sign({ sub: user.id }, process.env.SUPABASE_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

describe.skipIf(!dbReady)('integration API flow', () => {
  beforeAll(async () => {
    await resetTestSchema();
  });

  beforeEach(async () => {
    await truncateCoreTables();
  });

  it('admin ينشئ تصنيفاً وبراداً وعنصراً، وstaff يسجل دخول/خروج ثم يظهر السجل', async () => {
    const admin = await seedUser('admin');
    const staff = await seedUser('staff');
    const adminAuth = `Bearer ${tokenFor(admin)}`;
    const staffAuth = `Bearer ${tokenFor(staff)}`;

    const categoryRes = await request(app)
      .post('/api/categories')
      .set('Authorization', adminAuth)
      .send({ name: 'Käse' });
    expect(categoryRes.status).toBe(201);

    const locationRes = await request(app)
      .post('/api/locations')
      .set('Authorization', adminAuth)
      .send({ name: 'Kühlschrank 1', position: 1 });
    expect(locationRes.status).toBe(201);

    const itemRes = await request(app)
      .post('/api/items')
      .set('Authorization', adminAuth)
      .send({
        name: 'Gouda',
        unit: 'kg',
        minStockLevel: '1',
        categoryId: categoryRes.body.category.id,
        locationId: locationRes.body.location.id,
      });
    expect(itemRes.status).toBe(201);
    expect(itemRes.body.item.current_stock).toBe('0');

    const itemId = itemRes.body.item.id;
    const receiveRes = await request(app)
      .post('/api/transactions/receive')
      .set('Authorization', staffAuth)
      .send({ itemId, quantity: '2.5', note: 'Lieferung' });
    expect(receiveRes.status).toBe(201);
    expect(receiveRes.body.item.current_stock).toBe('2.5');

    const consumeRes = await request(app)
      .post('/api/transactions/consume')
      .set('Authorization', staffAuth)
      .send({ itemId, quantity: '0.5', type: 'waste', note: 'verdorben' });
    expect(consumeRes.status).toBe(201);
    expect(consumeRes.body.item.current_stock).toBe('2.0');

    const historyRes = await request(app)
      .get(`/api/transactions?locationId=${locationRes.body.location.id}&type=waste`)
      .set('Authorization', adminAuth);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.transactions).toHaveLength(1);
    expect(historyRes.body.transactions[0]).toMatchObject({
      type: 'waste',
      quantity_change: '-0.5',
      item_name: 'Gouda',
      location_name: 'Kühlschrank 1',
    });
  });

  it('staff لا يستطيع إنشاء عنصر admin-only', async () => {
    const staff = await seedUser('staff');
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${tokenFor(staff)}`)
      .send({ name: 'Schinken', unit: 'kg', minStockLevel: '1' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
