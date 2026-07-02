/**
 * setup.js
 * تجهيز بيئة الاختبار (القسم 9). يُشغَّل قبل كل ملف اختبار عبر vitest setupFiles.
 * المسؤولية الآن: ضبط متغيرات البيئة قبل تحميل أي وحدة تقرأ env.
 * لاحقاً (المرحلة 3): تنظيف قاعدة الاختبار المنفصلة قبل كل اختبار.
 *
 * يجب أن يسبق ضبط المتغيرات أول import لـ env.js (لذلك هو في setupFiles لا داخل الاختبار).
 */

process.env.NODE_ENV = 'test';
// قاعدة اختبار منفصلة (القسم 9). قيمة صورية تكفي لاختبارات المرحلة 2 لأننا نموّه الـ repository.
process.env.TEST_DATABASE_URL ??= 'postgresql://test:test@localhost:5432/inventory_test';
// سرّ توقيع ثابت للاختبار فقط — تُوقَّع به توكنات الاختبار ويتحقّق منه auth middleware.
process.env.SUPABASE_JWT_SECRET ??= 'test-jwt-secret-do-not-use-in-prod';
process.env.PORT ??= '3000';
