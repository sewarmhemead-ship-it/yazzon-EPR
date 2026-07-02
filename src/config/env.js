/**
 * env.js
 * الطبقة: config — تحميل متغيرات البيئة من .env والتحقق من وجود كل متغير مطلوب.
 * المسؤولية: مصدر واحد موثوق لكل الإعدادات؛ يفشل بسرعة وبوضوح إن نقص أي سر (القسم 2).
 * لا سرّ واحد مكتوب في الكود — كلها تأتي من هنا.
 */

import 'dotenv/config';

/** بيئة الاختبار تستخدم قاعدة منفصلة (القسم 9). */
const TEST_ENV = 'test';

/**
 * يقرأ متغيراً مطلوباً ويرمي خطأً واضحاً إن كان مفقوداً/فارغاً.
 * السبب: نكشف نقص الإعداد عند الإقلاع لا عند أول طلب في وقت التشغيل.
 * @param {string} name اسم المتغير في البيئة.
 * @returns {string} قيمة المتغير بعد قصّ الفراغات.
 * @throws {Error} إذا لم يكن المتغير معرَّفاً أو كان فارغاً.
 */
function required(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`متغير البيئة المطلوب مفقود: ${name} — راجع .env.example`);
  }
  return value.trim();
}

/**
 * يقرأ متغيراً اختيارياً ويعيد null عند غيابه/فراغه.
 * @param {string} name اسم المتغير.
 * @returns {string|null}
 */
function optional(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return null;
  }
  return value.trim();
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

// في بيئة الاختبار نُلزم استخدام قاعدة الاختبار المنفصلة حتى لا تُلمَس بيانات التطوير/الإنتاج.
const databaseUrl =
  nodeEnv === TEST_ENV ? required('TEST_DATABASE_URL') : required('DATABASE_URL');

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT غير صالح: "${process.env.PORT}" — يجب أن يكون رقماً موجباً`);
}

// إعدادات Supabase Auth.
// المشاريع الحديثة قد تستخدم JWKS/ES256 بدلاً من JWT secret/HS256.
const supabaseUrl = optional('SUPABASE_URL');
const supabaseJwtSecret = optional('SUPABASE_JWT_SECRET');
const supabaseJwksUrl =
  optional('SUPABASE_JWKS_URL') ||
  (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json` : null);
const supabaseJwksJson = optional('SUPABASE_JWKS_JSON');

if (!supabaseJwtSecret && !supabaseJwksUrl && !supabaseJwksJson) {
  throw new Error(
    'واحد من SUPABASE_JWT_SECRET أو SUPABASE_JWKS_URL أو SUPABASE_JWKS_JSON مطلوب للتحقق من توكنات Supabase',
  );
}

// منشأ/مناشئ الواجهة المسموح لها بـ CORS (المرحلة 5).
// يقبل قائمة مفصولة بفواصل لأن Vite قد يعرض localhost أو 127.0.0.1 أثناء التطوير.
const corsOrigin = process.env.CORS_ORIGIN?.trim() || 'http://localhost:5173,http://127.0.0.1:5173';
const corsOrigins = corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * إعدادات التطبيق — كائن مجمَّد لمنع أي تعديل عرضي أثناء التشغيل.
 * @type {Readonly<{ nodeEnv: string, isTest: boolean, port: number, databaseUrl: string, supabaseUrl: string|null, supabaseJwtSecret: string|null, supabaseJwksUrl: string|null, supabaseJwksJson: string|null, corsOrigin: string, corsOrigins: string[] }>}
 */
export const env = Object.freeze({
  nodeEnv,
  isTest: nodeEnv === TEST_ENV,
  port,
  databaseUrl,
  supabaseUrl,
  supabaseJwtSecret,
  supabaseJwksUrl,
  supabaseJwksJson,
  corsOrigin,
  corsOrigins,
});
