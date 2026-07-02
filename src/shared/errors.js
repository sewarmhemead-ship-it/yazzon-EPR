/**
 * errors.js
 * الطبقة: shared — أصناف أخطاء المجال.
 * المسؤولية: أخطاء ذات معنى تُرمى من الـ service، ويحوّلها errorHandler المركزي لردود HTTP.
 * السبب (القسم 6/بند 5): لا try/catch يبتلع الأخطاء بصمت؛ كل خطأ يحمل statusCode + code واضحين.
 */

/**
 * الأساس لكل أخطاء التطبيق المتوقّعة (أخطاء عمل، لا أعطال برمجية).
 * @property {number} statusCode رمز HTTP المناسب.
 * @property {string} code رمز آلي ثابت للعميل/الاختبارات.
 */
export class AppError extends Error {
  /**
   * @param {string} message رسالة موجّهة للمستخدم/المطوّر.
   * @param {number} statusCode رمز HTTP.
   * @param {string} code رمز آلي ثابت.
   */
  constructor(message, statusCode, code) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    // نميّز الأخطاء المتوقّعة (التشغيلية) عن الأعطال البرمجية عند المعالجة المركزية.
    this.isOperational = true;
  }
}

/** مورد غير موجود → 404. */
export class NotFoundError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'المورد غير موجود') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** مدخلات طلب غير صالحة → 400. */
export class ValidationError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'مدخلات غير صالحة') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/**
 * رصيد غير كافٍ لإتمام السحب → 409.
 * تُرمى عندما يعيد الـ UPDATE الشرطي الذرّي صفر صفوف [INV-1] (المرحلة 3).
 */
export class InsufficientStockError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'الرصيد غير كافٍ لإتمام العملية') {
    super(message, 409, 'INSUFFICIENT_STOCK');
  }
}

/** هوية غير موثّقة → 401. */
export class UnauthorizedError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'مطلوب تسجيل الدخول') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** موثّق لكن بلا صلاحية → 403 (RBAC، المرحلة 2). */
export class ForbiddenError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'لا تملك صلاحية لهذا الإجراء') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * يبني جسم رد خطأ HTTP الموحّد. مصدر واحد لشكل الرد حتى لا يتكرّر بناؤه في عدّة أماكن.
 * @param {string} code رمز آلي ثابت.
 * @param {string} message رسالة للعميل.
 * @returns {{ error: { code: string, message: string } }}
 */
export function errorBody(code, message) {
  return { error: { code, message } };
}
