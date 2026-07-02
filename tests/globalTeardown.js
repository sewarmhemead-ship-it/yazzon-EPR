/**
 * globalTeardown.js
 * الطبقة: test config — يغلق pool قاعدة البيانات مرة واحدة بعد انتهاء كل ملفات Vitest.
 */

export default async function globalTeardown() {
  const { pool } = await import('../src/config/db.js');
  await pool.end();
}
