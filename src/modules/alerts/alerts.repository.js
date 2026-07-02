/**
 * alerts.repository.js
 * الطبقة: repository — استعلامات SQL للتنبيهات فقط. لا منطق أعمال.
 * القاعدة (القسم 2): كل SQL يدوي و parameterized عبر node-postgres.
 * التنبيه استعلام لحظي (القسم 10) — لا jobs دورية ولا جدول PurchaseRequests.
 */

import { query } from '../../config/db.js';

/**
 * يجلب العناصر التي بلغت حدّها الأدنى أو نزلت تحته (تحتاج شراءً).
 * الترتيب (القسم 10): غير المطلوبة أولاً (is_ordered ASC)، ثم الأشدّ نقصاً أولاً
 * (min_stock_level - current_stock) DESC — ليرى المدير الأولوية فوراً.
 * @returns {Promise<object[]>} صفوف العناصر المنخفضة.
 */
export async function getLowStockItems() {
  const { rows } = await query(
    `SELECT * FROM items
     WHERE current_stock <= min_stock_level
     ORDER BY is_ordered ASC, (min_stock_level - current_stock) DESC`,
  );
  return rows;
}

/**
 * يضبط حالة "تم طلبه" لعنصر ويحدّث زمن آخر طلب.
 * السبب (القسم 7): يفصل "مطلوب" عن "مطلوب وتم طلبه" فلا يتكرّر التنبيه بعد إرسال الطلب.
 * @param {string} itemId معرّف العنصر.
 * @param {boolean} isOrdered القيمة الجديدة.
 * @returns {Promise<object | null>} صفّ العنصر بعد التحديث، أو null إن لم يوجد.
 */
export async function setItemOrdered(itemId, isOrdered) {
  const { rows } = await query(
    `UPDATE items
     SET is_ordered = $1,
         last_ordered_at = CASE WHEN $1 THEN now() ELSE last_ordered_at END
     WHERE id = $2
     RETURNING *`,
    [isOrdered, itemId],
  );
  return rows[0] ?? null;
}
