/**
 * transactions.test.js
 * اختبارات المرحلة 3 (منطق المخزون) — القسم 9، الاختبارات 1..7 و 9.
 * تتطلّب قاعدة PostgreSQL حيّة عبر TEST_DATABASE_URL. إن تعذّر الاتصال تُتخطّى الحزمة كاملةً
 * (حتى لا تفشل الجلسة بلا قاعدة). عند تجهيز القاعدة، شغّل: npm test.
 *
 * التغطية:
 *   [1] سحب صحيح  [2] منع الرصيد السالب  [3] الحدّ الصفري  [4] الإدخال
 *   [5] التزامن (الأهم)  [6] الذرّية (rollback)  [7] الـ Undo  [9] دقة الأرقام
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
    'تخطّي اختبارات المخزون. جهّز قاعدة اختبار وأعد npm test لتشغيلها.',
  );
}

/** يزرع عنصراً برصيد ابتدائي ويعيد صفّه. */
async function seedItem(currentStock, minStock = 1) {
  const { rows } = await pool.query(
    `INSERT INTO items (name, unit, current_stock, min_stock_level)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    ['طحين', 'كجم', currentStock, minStock],
  );
  return rows[0];
}

/** يزرع مستخدماً (id صريح لأن users.id بلا DEFAULT) ويعيد معرّفه. */
async function seedUser(role = 'staff') {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO users (id, name, email, role) VALUES ($1, $2, $3, $4)',
    [id, 'مستخدم اختبار', `${id}@test.com`, role],
  );
  return id;
}

/** يقرأ رصيد عنصر حالياً كنصّ numeric (كما تعيده pg). */
async function stockOf(itemId) {
  const { rows } = await pool.query('SELECT current_stock FROM items WHERE id = $1', [itemId]);
  return rows[0].current_stock;
}

/** يعدّ حركات عنصر بنوع معيّن. */
async function countTx(itemId, type) {
  const { rows } = await pool.query(
    'SELECT count(*)::int AS n FROM transactions WHERE item_id = $1 AND type = $2',
    [itemId, type],
  );
  return rows[0].n;
}

describe.skipIf(!dbReady)('منطق المخزون (transactions.service)', () => {
  beforeAll(async () => {
    // تهيئة المخطط من كل migrations الحالية (001, 002, ...) قبل integration/stress.
    await resetTestSchema();
  });

  beforeEach(async () => {
    // [القسم 9] قاعدة اختبار تُنظَّف قبل كل اختبار.
    await truncateCoreTables();
  });

  it('[1] السحب الصحيح: ينقص الرصيد ويُدرج صف out', async () => {
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

  it('[2] منع الرصيد السالب: سحب > الرصيد يُرفض والرصيد لا يتغيّر', async () => {
    const user = await seedUser();
    const item = await seedItem('5');

    await expect(
      consumeStock({ itemId: item.id, userId: user, quantity: '8' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });

    expect(await stockOf(item.id)).toBe('5'); // لم يتغيّر
    expect(await countTx(item.id, TX_TYPE.OUT)).toBe(0); // لا حركة
  });

  it('[3] الحدّ الصفري: سحب = الرصيد بالضبط ينجح ويصل صفر', async () => {
    const user = await seedUser();
    const item = await seedItem('5');

    const { item: updated } = await consumeStock({
      itemId: item.id,
      userId: user,
      quantity: '5',
    });

    expect(updated.current_stock).toBe('0');
  });

  it('[4] الإدخال: يزيد الرصيد ويُدرج صف in', async () => {
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

  it('[5] التزامن: سحبان متوازيان على رصيد يكفي لواحد → واحد ينجح وواحد يفشل', async () => {
    const user = await seedUser();
    const item = await seedItem('5');

    // كلاهما يطلب 5 والرصيد 5 — يجب أن ينجح واحد فقط [INV-1].
    const results = await Promise.allSettled([
      consumeStock({ itemId: item.id, userId: user, quantity: '5' }),
      consumeStock({ itemId: item.id, userId: user, quantity: '5' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.code).toBe('INSUFFICIENT_STOCK');

    // الرصيد النهائي صحيح وغير سالب، وحركة سحب واحدة فقط سُجّلت.
    expect(await stockOf(item.id)).toBe('0');
    expect(await countTx(item.id, TX_TYPE.OUT)).toBe(1);
  });

  it('[6] الذرّية: فشل إدراج الحركة يُرجع الرصيد كما كان (rollback)', async () => {
    const item = await seedItem('10');
    // userId غير موجود → الإنقاص ينجح ثم يفشل INSERT على قيد FK داخل نفس المعاملة [INV-2].
    const ghostUser = randomUUID();

    await expect(
      consumeStock({ itemId: item.id, userId: ghostUser, quantity: '4' }),
    ).rejects.toThrow();

    expect(await stockOf(item.id)).toBe('10'); // تراجعت المعاملة كاملةً
    expect(await countTx(item.id, TX_TYPE.OUT)).toBe(0);
  });

  it('[7] الـ Undo: حركة عكسية تعيد الكمية دون حذف/تعديل الأصلية', async () => {
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

    // الرصيد عاد، والحركة العكسية تشير للأصلية [INV-3].
    expect(restored.current_stock).toBe('10');
    expect(reversal.reverses_transaction_id).toBe(original.id);

    // الأصلية باقية كما هي (لا حذف/تعديل) [INV-3].
    const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1', [original.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity_change).toBe('-3');

    // لا يمكن التراجع مرتين عن نفس الحركة.
    await expect(
      undoTransaction({ transactionId: original.id, userId: user }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('[9] دقة الأرقام: كميات كسرية بلا أخطاء تقريب', async () => {
    const user = await seedUser();
    const item = await seedItem('0');

    await addStock({ itemId: item.id, userId: user, quantity: '0.1' });
    await addStock({ itemId: item.id, userId: user, quantity: '0.2' });
    // 0.1 + 0.2 = 0.3 بالضبط في numeric (بخلاف float في JS).
    expect(await stockOf(item.id)).toBe('0.3');

    await consumeStock({ itemId: item.id, userId: user, quantity: '0.2' });
    expect(await stockOf(item.id)).toBe('0.1');

    await addStock({ itemId: item.id, userId: user, quantity: '2.5' });
    expect(await stockOf(item.id)).toBe('2.6');
  });
});
