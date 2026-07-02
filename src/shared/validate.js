/**
 * validate.js
 * الطبقة: shared — تحقّق من مدخلات الطلبات وتطبيعها.
 * المسؤولية: رفض المدخلات غير الصالحة مبكراً برمي ValidationError (يحوّلها errorHandler لـ 400).
 *
 * ⚠️ [INV-4] الكميات numeric بلا تقريب: نتعامل مع الكمية كـ نصّ عشري ونمرّره كما هو إلى
 *    PostgreSQL. لا نحوّلها إلى Number في JS (يفقد الدقة: 0.1 + 0.2). الحساب يتم في numeric.
 */

import { ValidationError } from './errors.js';

/** نمط رقم عشري موجب: أرقام صحيحة أو كسرية بلا إشارة. */
const POSITIVE_DECIMAL = /^\d+(\.\d+)?$/;
/** نمط رقم عشري موقّع: يسمح بإشارة سالبة (للتسويات). */
const SIGNED_DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * يتحقّق أن القيمة نصّ/رقم يمثّل كمية موجبة صالحة، ويعيدها كنصّ عشري.
 * السبب: تمرير النص إلى pg يحفظ دقّة numeric [INV-4]؛ والرفض المبكر يمنع كميات لا معنى لها.
 * @param {unknown} value القيمة القادمة من الطلب.
 * @param {string} field اسم الحقل (لرسالة الخطأ).
 * @returns {string} الكمية كنصّ عشري موجب.
 * @throws {ValidationError} إذا لم تكن رقماً موجباً صالحاً.
 */
export function assertPositiveQuantity(value, field) {
  const str = typeof value === 'number' ? String(value) : value;
  if (typeof str !== 'string' || !POSITIVE_DECIMAL.test(str.trim())) {
    throw new ValidationError(`${field} يجب أن يكون رقماً موجباً صالحاً`);
  }
  const normalized = str.trim();
  if (Number(normalized) <= 0) {
    throw new ValidationError(`${field} يجب أن يكون أكبر من صفر`);
  }
  return normalized;
}

/**
 * يتحقّق أن القيمة كمية موقّعة غير صفرية (للتسويات)، ويعيدها كنصّ عشري.
 * غير الصفرية لأن الحركة الصفرية بلا معنى وتخالف قيد قاعدة البيانات.
 * @param {unknown} value القيمة القادمة من الطلب.
 * @param {string} field اسم الحقل.
 * @returns {string} الفرق كنصّ عشري موقّع (قد يبدأ بـ -).
 * @throws {ValidationError} إذا لم تكن رقماً موقّعاً صالحاً أو كانت صفراً.
 */
export function assertSignedNonZeroQuantity(value, field) {
  const str = typeof value === 'number' ? String(value) : value;
  if (typeof str !== 'string' || !SIGNED_DECIMAL.test(str.trim())) {
    throw new ValidationError(`${field} يجب أن يكون رقماً صالحاً`);
  }
  const normalized = str.trim();
  if (Number(normalized) === 0) {
    throw new ValidationError(`${field} لا يمكن أن يكون صفراً`);
  }
  return normalized;
}

/**
 * يتحقّق أن القيمة نصّ غير فارغ ويعيدها مقصوصة.
 * @param {unknown} value القيمة.
 * @param {string} field اسم الحقل.
 * @returns {string} النص المقصوص.
 * @throws {ValidationError} إذا كان فارغاً أو ليس نصاً.
 */
export function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${field} مطلوب`);
  }
  return value.trim();
}
