/**
 * requireRole.js
 * الطبقة: middleware — التحكم بالوصول حسب الدور (RBAC).
 * المسؤولية: السماح فقط للأدوار المصرّح لها بمسار ما. يُركّب بعد requireAuth.
 * (القسم 2: الحماية مسؤولية Express — RLS مُطفأة.)
 */

import { ForbiddenError, UnauthorizedError } from '../shared/errors.js';

/**
 * مصنع middleware يقصر الوصول على الأدوار المسموحة.
 * السبب: نفصل "من أنت" (requireAuth) عن "هل يحقّ لك" (requireRole) ليعاد استخدام
 * القاعدة على أي مسار admin دون تكرار منطق الفحص.
 * @param {...string} allowedRoles الأدوار المسموح لها (مثل 'admin').
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    // يجب أن يكون requireAuth قد سبق هذا الـ middleware ووضع req.user.
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}
