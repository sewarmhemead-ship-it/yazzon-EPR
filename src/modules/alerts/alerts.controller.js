/**
 * alerts.controller.js
 * الطبقة: controller — HTTP فقط: يقرأ الطلب، يستدعي الـ service، يعيد الرد. لا منطق أعمال.
 * الأخطاء تُمرَّر عبر next(err) إلى errorHandler المركزي.
 */

import { listAlerts, markOrdered } from './alerts.service.js';

/** يعيد قائمة عناصر النقص (تحتاج شراءً). */
export async function getAlerts(_req, res, next) {
  try {
    const items = await listAlerts();
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/** يعلّم عنصراً بأنه تم طلبه (is_ordered = true). */
export async function markItemOrdered(req, res, next) {
  try {
    const item = await markOrdered(req.params.id, true);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

/** يلغي علامة الطلب عن عنصر (is_ordered = false) — تصحيح يدوي إن لزم. */
export async function unmarkItemOrdered(req, res, next) {
  try {
    const item = await markOrdered(req.params.id, false);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}
