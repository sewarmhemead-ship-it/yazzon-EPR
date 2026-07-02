/**
 * errorHandler.js
 * الطبقة: middleware — معالج الأخطاء المركزي (آخر middleware في السلسلة).
 * المسؤولية: تحويل الأخطاء المرميّة من أي طبقة إلى ردود HTTP موحّدة (القسم 6/بند 5).
 * لا يُبتلَع أي خطأ بصمت: الأخطاء غير المتوقّعة تُسجَّل وتُعاد كـ 500 عام دون تسريب تفاصيل داخلية.
 */

import { AppError, errorBody } from '../shared/errors.js';

/** رمز/رسالة الرد الافتراضي للأعطال غير المتوقّعة. */
const INTERNAL_ERROR = Object.freeze({
  statusCode: 500,
  code: 'INTERNAL_ERROR',
  message: 'حدث خطأ داخلي غير متوقّع',
});

/**
 * معالج أخطاء Express (يجب أن يبقى بأربعة معاملات ليتعرّف عليه Express كمعالج أخطاء).
 * @param {unknown} err الخطأ المرميّ.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
// المعامل الرابع _next مطلوب في توقيع معالج أخطاء Express حتى لو لم يُستخدم.
export function errorHandler(err, _req, res, _next) {
  // أخطاء المجال المتوقّعة: نثق برمزها ورسالتها.
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(errorBody(err.code, err.message));
  }

  // أي شيء آخر عطل برمجي غير متوقّع: نسجّله كاملاً للتشخيص، ونعيد رداً عاماً فقط.
  console.error('[errorHandler] خطأ غير متوقّع:', err);
  return res
    .status(INTERNAL_ERROR.statusCode)
    .json(errorBody(INTERNAL_ERROR.code, INTERNAL_ERROR.message));
}
