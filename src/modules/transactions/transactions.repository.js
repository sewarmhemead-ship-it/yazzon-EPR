/**
 * transactions.repository.js
 * الطبقة: repository — استعلامات SQL لحركات المخزون فقط. لا منطق أعمال.
 * يفرض على مستوى SQL: [INV-1] لا رصيد سالب (UPDATE شرطي ذرّي)، [INV-3] السجل ثابت (INSERT فقط).
 *
 * دوال الكتابة تستقبل `client` (عميل معاملة) لتنفَّذ ضمن نفس الـ transaction [INV-2]؛
 * القراءات العامة (سجل الحركات) تستخدم query على الـ pool مباشرة.
 * القاعدة (القسم 2): كل SQL يدوي و parameterized عبر node-postgres.
 */

import { query } from '../../config/db.js';

/**
 * ينقص رصيد عنصر بمقدار موجب، ذرّياً، شرط توفّر الرصيد.
 * ⚠️ [INV-1] UPDATE شرطي ذرّي واحد — لا تحوّله أبداً إلى SELECT ثم UPDATE:
 *    الشرط `current_stock >= $qty` داخل نفس الجملة يمنع الـ Race Condition (سحبان متوازيان).
 *    صفر صفوف راجعة = رصيد غير كافٍ (يترجمها الـ service إلى رفض).
 * @param {import('pg').PoolClient} client عميل المعاملة.
 * @param {string} itemId معرّف العنصر.
 * @param {string|number} quantity الكمية المسحوبة (موجبة).
 * @returns {Promise<object | null>} صفّ العنصر بعد التحديث، أو null إن لم يكفِ الرصيد.
 */
export async function decrementStock(client, itemId, quantity) {
  const { rows } = await client.query(
    `UPDATE items SET current_stock = current_stock - $1
     WHERE id = $2 AND current_stock >= $1
     RETURNING *`,
    [quantity, itemId],
  );
  return rows[0] ?? null;
}

/**
 * يزيد رصيد عنصر بمقدار موجب، ذرّياً (عملية الاستلام — حركة in حصراً).
 * لا شرط رصيد هنا (الإضافة لا تُنقص). يعيد null إن كان العنصر غير موجود.
 * ملاحظة: يعيد is_ordered إلى false لأن الاستلام يعني وصول التوصيلة (القسم 7) —
 * وهذا مقصور على الاستلام؛ التسويات/التراجع تستخدم applyStockDelta ولا تمسّ العلم.
 * @param {import('pg').PoolClient} client عميل المعاملة.
 * @param {string} itemId معرّف العنصر.
 * @param {string|number} quantity الكمية المضافة (موجبة).
 * @returns {Promise<object | null>} صفّ العنصر بعد التحديث، أو null إن لم يوجد العنصر.
 */
export async function incrementStock(client, itemId, quantity) {
  const { rows } = await client.query(
    `UPDATE items SET current_stock = current_stock + $1, is_ordered = false
     WHERE id = $2
     RETURNING *`,
    [quantity, itemId],
  );
  return rows[0] ?? null;
}

/**
 * يطبّق فرقاً موقّعاً على الرصيد ذرّياً مع منع النزول تحت الصفر [INV-1].
 * يُستخدم في التسويات (adjustment) التي قد تكون موجبة أو سالبة.
 * الشرط `current_stock + $delta >= 0` يضمن عدم وجود رصيد سالب حتى مع دلتا سالبة.
 * @param {import('pg').PoolClient} client عميل المعاملة.
 * @param {string} itemId معرّف العنصر.
 * @param {string|number} delta الفرق الموقّع (+/-).
 * @returns {Promise<object | null>} صفّ العنصر بعد التحديث، أو null إن نتج رصيد سالب/عنصر غير موجود.
 */
export async function applyStockDelta(client, itemId, delta) {
  const { rows } = await client.query(
    `UPDATE items SET current_stock = current_stock + $1
     WHERE id = $2 AND current_stock + $1 >= 0
     RETURNING *`,
    [delta, itemId],
  );
  return rows[0] ?? null;
}

/**
 * يُدرج صفّ حركة في السجل الثابت [INV-3]. INSERT فقط — لا UPDATE/DELETE أبداً.
 * created_at يُترك لقيمة السيرفر الافتراضية (now()) لضمان ترتيب زمني موثوق.
 * @param {import('pg').PoolClient} client عميل المعاملة.
 * @param {object} tx بيانات الحركة.
 * @param {string} tx.itemId
 * @param {string} tx.userId
 * @param {'in'|'out'|'waste'|'adjustment'} tx.type
 * @param {string|number} tx.quantityChange موجب=إدخال، سالب=سحب.
 * @param {string|null} [tx.note]
 * @param {string|null} [tx.reversesTransactionId] الحركة الأصلية عند التصحيح.
 * @returns {Promise<object>} صفّ الحركة المُدرَج.
 */
export async function insertTransaction(client, tx) {
  const { rows } = await client.query(
    `INSERT INTO transactions
       (item_id, user_id, type, quantity_change, note, reverses_transaction_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      tx.itemId,
      tx.userId,
      tx.type,
      tx.quantityChange,
      tx.note ?? null,
      tx.reversesTransactionId ?? null,
    ],
  );
  return rows[0];
}

/**
 * يجلب حركة بمعرّفها (للتحقق قبل التراجع). قراءة فقط.
 * @param {import('pg').PoolClient} client عميل المعاملة.
 * @param {string} transactionId
 * @returns {Promise<object | null>} صفّ الحركة أو null.
 */
export async function findTransactionById(client, transactionId) {
  const { rows } = await client.query(
    'SELECT * FROM transactions WHERE id = $1',
    [transactionId],
  );
  return rows[0] ?? null;
}

/**
 * يتحقّق إن كانت حركة ما قد تُرِاجِعت من قبل (لمنع التراجع المزدوج) [INV-3].
 * @param {import('pg').PoolClient} client عميل المعاملة.
 * @param {string} transactionId الحركة الأصلية.
 * @returns {Promise<boolean>} true إن وُجدت حركة تشير إليها عبر reverses_transaction_id.
 */
export async function hasReversal(client, transactionId) {
  const { rows } = await client.query(
    'SELECT 1 FROM transactions WHERE reverses_transaction_id = $1 LIMIT 1',
    [transactionId],
  );
  return rows.length > 0;
}

/**
 * يقرأ سجل الحركات (الأحدث أولاً) مع اسم العنصر والمستخدم والقسم — قراءة فقط من
 * السجل الثابت [INV-3]. الفلاتر اختيارية وتُجمَّع ديناميكياً مع بقاء كل القيم parameterized.
 * @param {object} filters
 * @param {string|null} [filters.itemId] حصر بعنصر.
 * @param {string|null} [filters.locationId] حصر بقسم (براد).
 * @param {string|null} [filters.type] حصر بنوع (in|out|waste|adjustment).
 * @param {number} [filters.limit] حدّ أقصى للصفوف (افتراضي 50).
 * @returns {Promise<object[]>}
 */
export async function listTransactions({ itemId, locationId, type, limit = 50 } = {}) {
  const conditions = [];
  const params = [];
  if (itemId) {
    params.push(itemId);
    conditions.push(`t.item_id = $${params.length}`);
  }
  if (locationId) {
    params.push(locationId);
    conditions.push(`i.location_id = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`t.type = $${params.length}`);
  }
  params.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT t.id, t.type, t.quantity_change, t.note, t.created_at,
            t.reverses_transaction_id, t.item_id,
            i.name AS item_name, i.unit,
            u.name AS user_name,
            l.name AS location_name
     FROM transactions t
     JOIN items i ON i.id = t.item_id
     JOIN users u ON u.id = t.user_id
     LEFT JOIN locations l ON l.id = i.location_id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}
