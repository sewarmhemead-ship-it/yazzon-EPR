/**
 * items.repository.js
 * الطبقة: repository — استعلامات SQL للعناصر فقط. لا منطق أعمال.
 * القاعدة (القسم 2): كل SQL يدوي و parameterized عبر node-postgres.
 * (تُوسَّع هذه الطبقة في مرحلة واجهة العناصر؛ الآن تكفي القراءة التي يحتاجها منطق الحركات.)
 */

import { query } from '../../config/db.js';

/**
 * يجلب كل العناصر مرتّبة بالاسم (لقائمة الواجهة)، مع اسم التصنيف والقسم إن وُجدا.
 * @returns {Promise<object[]>} صفوف العناصر (+ category_name, location_name).
 */
export async function listItems() {
  const { rows } = await query(
    `SELECT items.*, categories.name AS category_name, locations.name AS location_name
     FROM items
     LEFT JOIN categories ON categories.id = items.category_id
     LEFT JOIN locations ON locations.id = items.location_id
     ORDER BY items.name ASC`,
  );
  return rows;
}

/**
 * يجلب عنصراً بمعرّفه (قراءة عامة خارج المعاملة).
 * @param {string} id معرّف العنصر.
 * @returns {Promise<object | null>} صفّ العنصر أو null.
 */
export async function findItemById(id) {
  const { rows } = await query('SELECT * FROM items WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/**
 * يُنشئ عنصراً جديداً. لا يقبل current_stock: كل رصيد يبدأ صفراً ويتغيّر عبر حركات مسجّلة
 * فقط [INV-3]. أي رصيد ابتدائي يُضاف بحركة in منفصلة.
 * @param {object} data
 * @param {string} data.name
 * @param {string} data.unit الوحدة الأساسية [INV-6].
 * @param {string} data.minStockLevel حدّ التنبيه الأدنى (نصّ numeric) [INV-4].
 * @param {string|null} [data.categoryId]
 * @returns {Promise<object>} صفّ العنصر المُنشأ.
 */
export async function createItem({ name, unit, minStockLevel, categoryId, locationId }) {
  const { rows } = await query(
    `INSERT INTO items (name, unit, min_stock_level, category_id, location_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, unit, minStockLevel, categoryId ?? null, locationId ?? null],
  );
  return rows[0];
}

/**
 * يعدّل بيانات عنصر (وصفية فقط) دون المساس بـ current_stock [INV-3].
 * يستعمل COALESCE فيقبل تحديثاً جزئياً: الحقول غير المُمرَّرة (null) تبقى كما هي.
 * @param {string} id معرّف العنصر.
 * @param {object} data
 * @param {string|null} [data.name]
 * @param {string|null} [data.unit]
 * @param {string|null} [data.minStockLevel]
 * @param {string|null} [data.categoryId]
 * @returns {Promise<object | null>} صفّ العنصر بعد التعديل، أو null إن لم يوجد.
 */
export async function updateItem(id, { name, unit, minStockLevel, categoryId, locationId }) {
  const { rows } = await query(
    `UPDATE items
     SET name            = COALESCE($2, name),
         unit            = COALESCE($3, unit),
         min_stock_level = COALESCE($4, min_stock_level),
         category_id     = COALESCE($5, category_id),
         location_id     = COALESCE($6, location_id)
     WHERE id = $1
     RETURNING *`,
    [id, name ?? null, unit ?? null, minStockLevel ?? null, categoryId ?? null, locationId ?? null],
  );
  return rows[0] ?? null;
}

/**
 * يجلب عنصراً بمعرّفه ضمن معاملة قائمة (باستخدام عميلها).
 * يُستخدم فقط لتمييز "عنصر غير موجود" عن "رصيد غير كافٍ" بعد فشل UPDATE الذرّي —
 * لا يُستخدم أبداً لاتخاذ قرار الإنقاص (ذلك يبقى في UPDATE الشرطي الذرّي [INV-1]).
 * @param {import('pg').PoolClient} client عميل المعاملة.
 * @param {string} id معرّف العنصر.
 * @returns {Promise<object | null>} صفّ العنصر أو null.
 */
export async function findItemByIdTx(client, id) {
  const { rows } = await client.query('SELECT * FROM items WHERE id = $1', [id]);
  return rows[0] ?? null;
}
