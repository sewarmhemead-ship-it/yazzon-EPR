/**
 * auth.js
 * الطبقة: middleware — التحقق من هوية المستخدم عبر توكن Supabase (JWT).
 * المسؤولية: قبول الطلبات الموثّقة فقط ووضع المستخدم على req.user للطبقات التالية.
 *
 * قرارات المرحلة 2:
 *   - التحقق محلياً من توقيع JWT عبر SUPABASE_JWT_SECRET أو JWKS حسب إعداد Supabase.
 *   - المستخدم يجب أن يكون موجوداً مسبقاً في جدول users؛ توكن لهوية بلا صفّ → 401.
 *   - الصلاحيات تُفرَض هنا وفي requireRole — RLS مُطفأة (القسم 2).
 */

import { UnauthorizedError } from '../shared/errors.js';
import { findUserById } from '../modules/auth/auth.repository.js';
import { verifySupabaseJwt } from './verifySupabaseJwt.js';

/** بادئة نظام المصادقة في ترويسة Authorization. */
const BEARER_PREFIX = 'Bearer ';

/**
 * middleware يتحقّق من توكن الطلب ويحمّل المستخدم إلى req.user.
 * async ويُمرّر الأخطاء عبر next(err) لأن Express 4 لا يلتقط رمي الدوال async تلقائياً.
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedError('توكن المصادقة مفقود');
    }
    const token = header.slice(BEARER_PREFIX.length).trim();

    let payload;
    try {
      payload = await verifySupabaseJwt(token);
    } catch {
      // لا نسرّب سبب الفشل (منتهٍ/توقيع خاطئ) للعميل — كله "غير صالح".
      throw new UnauthorizedError('توكن غير صالح أو منتهٍ');
    }

    const userId = payload.sub;
    if (!userId) {
      throw new UnauthorizedError('توكن بلا معرّف مستخدم');
    }

    // 2-ب: الهوية يجب أن تقابل صفّ users موجوداً مسبقاً؛ لا إنشاء تلقائي.
    const user = await findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('المستخدم غير معروف');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
