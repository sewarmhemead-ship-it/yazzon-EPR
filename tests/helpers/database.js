/**
 * database.js
 * الطبقة: test helper — تجهيز قاعدة الاختبار الحقيقية لاختبارات integration/stress.
 * يطبّق كل migrations بالترتيب حتى تبقى الاختبارات مطابقة للمخطط الحالي قبل الرفع.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { pool } from '../../src/config/db.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

/**
 * يتحقق من توفر TEST_DATABASE_URL خلال مهلة قصيرة.
 * @returns {Promise<boolean>}
 */
export async function canConnectToTestDatabase() {
  const probe = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    connectionTimeoutMillis: 2000,
  });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end();
  }
}

/**
 * محلياً: يطبع سبب تخطي اختبارات DB. في CI: يفشل صراحةً حتى لا تمر البوابة بلا integration.
 * @param {string} label اسم مجموعة الاختبار.
 * @param {string} message رسالة توضيحية.
 */
export function handleMissingTestDatabase(label, message) {
  const text = `[${label}] TEST_DATABASE_URL غير متاحة — ${message}`;
  if (process.env.CI === 'true') {
    throw new Error(`${text} داخل CI؛ لا يجوز تخطي اختبارات قاعدة البيانات قبل الرفع.`);
  }
  console.warn(`\n${text}\n`);
}

/**
 * يعيد بناء مخطط الاختبار من الصفر عبر كل migrations الترقيمية.
 * السبب: أي migration جديد يجب أن يظهر في CI فوراً، لا أن تبقى الاختبارات على 001 فقط.
 */
export async function resetTestSchema() {
  await pool.query(`
    DROP TABLE IF EXISTS
      schema_migrations,
      transactions,
      items,
      categories,
      locations,
      users
    CASCADE
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    await pool.query(sql);
  }
}

/** ينظف بيانات الاختبار مع إبقاء المخطط كما هو. */
export async function truncateCoreTables() {
  await pool.query(`
    TRUNCATE
      transactions,
      items,
      categories,
      locations,
      users
    RESTART IDENTITY CASCADE
  `);
}
