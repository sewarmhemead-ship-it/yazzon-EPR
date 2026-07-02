/**
 * alerts.service.js
 * الطبقة: service — منطق أعمال التنبيهات.
 * المسؤولية: جلب قائمة النقص، وإدارة علم is_ordered (تعليم/إلغاء الطلب).
 * (أضيفت هذه الطبقة للحفاظ على قاعدة القسم 5: الـ controller بلا منطق أعمال.)
 * التنبيه استعلام لحظي (القسم 10) — لا jobs ولا جداول إضافية.
 */

import { NotFoundError } from '../../shared/errors.js';
import { assertNonEmptyString } from '../../shared/validate.js';
import { getLowStockItems, setItemOrdered } from './alerts.repository.js';

/**
 * يعيد العناصر التي تحتاج شراءً (بلغت حدّها الأدنى أو تحته)، بالترتيب المطلوب (القسم 10).
 * @returns {Promise<object[]>}
 */
export async function listAlerts() {
  return getLowStockItems();
}

/**
 * يعلّم عنصراً بأنه "تم طلبه" (أو يلغي ذلك) — لمنع تكرار التنبيه بعد إرسال طلب الشراء (القسم 7).
 * إعادة is_ordered إلى false عند الاستلام تتم تلقائياً في مسار addStock، لا هنا.
 * @param {string} itemId معرّف العنصر.
 * @param {boolean} isOrdered القيمة الجديدة.
 * @returns {Promise<object>} صفّ العنصر بعد التحديث.
 * @throws {NotFoundError} إن لم يوجد العنصر.
 */
export async function markOrdered(itemId, isOrdered) {
  const id = assertNonEmptyString(itemId, 'itemId');
  const item = await setItemOrdered(id, Boolean(isOrdered));
  if (!item) {
    throw new NotFoundError('العنصر غير موجود');
  }
  return item;
}
