/**
 * db.js
 * الطبقة: config — pool اتصال node-postgres (pg) هو نقطة الوصول الوحيدة لقاعدة البيانات.
 * المسؤولية: توفير pool مشترك + مساعد query موحّد. لا منطق أعمال هنا.
 *
 * قواعد صارمة (القسم 2):
 *   - كل الوصول عبر pg فقط. ممنوع supabase-js داخل كود الـ backend.
 *   - كل SQL يُكتب يدوياً و parameterized ($1, $2 ...) — لا دمج قيم في نص الاستعلام.
 */

import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

/**
 * pool اتصالات مشترك عبر التطبيق كله.
 * السبب: إعادة استخدام الاتصالات أرخص وأأمن من فتح اتصال لكل طلب،
 * وضروري للمعاملات الذرّية [INV-2] عبر getClient().
 */
export let pool = new Pool({ connectionString: env.databaseUrl });

// نكشف أخطاء الاتصالات الخاملة بدل ابتلاعها بصمت (القسم 6/بند 5).
pool.on('error', (err) => {
  console.error('[db] خطأ غير متوقع في اتصال خامل بالـ pool:', err);
});

export function setPool(newPool) {
  pool = newPool;
}

/**
 * ينفّذ استعلاماً parameterized واحداً على الـ pool.
 * للاستعلامات المفردة فقط؛ المعاملات متعددة الخطوات تستخدم withTransaction (getClient).
 * @param {string} text نص SQL بمعاملات مواضعية ($1, $2 ...).
 * @param {unknown[]} [params] قيم المعاملات بالترتيب.
 * @returns {Promise<import('pg').QueryResult>} نتيجة الاستعلام.
 */
export function query(text, params) {
  return pool.query(text, params);
}

/**
 * يحجز عميل اتصال مخصّصاً من الـ pool لتنفيذ معاملة متعددة الخطوات.
 * على المستدعي استدعاء client.release() دائماً (يتكفّل withTransaction بذلك). [INV-2]
 * @returns {Promise<import('pg').PoolClient>} عميل محجوز.
 */
export function getClient() {
  return pool.connect();
}
