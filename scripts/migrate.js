/**
 * migrate.js
 * الطبقة: أداة تشغيل (script) — يطبّق ملفات migrations/*.sql بالترتيب الترقيمي.
 * المسؤولية: تنفيذ الـ migrations مرة واحدة وتتبّع المطبّق منها في جدول schema_migrations.
 * السبب (القسم 8/بند 7): كل تغيير schema عبر ملف migration، لا من لوحة Supabase.
 * كل ملف يُطبَّق داخل معاملة واحدة — يُطبَّق كاملاً أو لا يُطبَّق (لا حالة نصفية).
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import 'dotenv/config';
import pg from 'pg';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));
const { Client } = pg;

/**
 * يقرأ DATABASE_URL مباشرة من بيئة العملية قبل أي محاولة اتصال.
 * السبب: Railway يشغّل هذا السكربت في preDeploy؛ نريد خطأً صريحاً إن لم تصل
 * متغيرات Railway بدلاً من محاولة اتصال مضللة على localhost.
 * @returns {string}
 */
function readDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error(
      '[migrate] DATABASE_URL غير موجود أو فارغ. أضفه في Railway → Service → Variables قبل إعادة النشر.',
    );
    console.error('[migrate] لن يحاول السكربت الاتصال بقاعدة بيانات افتراضية أو localhost.');
    process.exit(1);
  }
  return databaseUrl;
}

/**
 * يطبع وجهة الاتصال بدون كشف كلمة المرور.
 * @param {string} databaseUrl
 */
function logDatabaseTarget(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    console.log(`[migrate] DATABASE_URL موجود. الاتصال بـ ${parsed.hostname}:${parsed.port || '5432'}/${parsed.pathname.replace(/^\//, '')}`);
  } catch {
    console.log('[migrate] DATABASE_URL موجود، لكن تعذر تحليل الوجهة للطباعة.');
  }
}

/** يضمن وجود جدول تتبّع الـ migrations المطبّقة. */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text        PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
}

/** @returns {Promise<Set<string>>} أسماء الملفات المطبّقة سابقاً. */
async function loadApplied(client) {
  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function main() {
  const databaseUrl = readDatabaseUrl();
  logDatabaseTarget(databaseUrl);

  const client = new Client({
    connectionString: databaseUrl,
  });

  await client.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await loadApplied(client);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort(); // الترتيب الترقيمي (001, 002, ...) يحدّد ترتيب التطبيق.

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`↷ متجاوَز (مطبَّق): ${file}`);
        continue;
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✓ طُبِّق: ${file}`);
        count += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`فشل تطبيق ${file}: ${err.message}`, { cause: err });
      }
    }
    console.log(count === 0 ? 'لا migrations جديدة.' : `اكتمل: ${count} migration.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[migrate] فشل:', err);
  process.exit(1);
});
