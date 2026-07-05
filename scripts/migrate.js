/**
 * migrate.js
 * Layer: script — applies migrations/*.sql in numeric order, exactly once,
 * tracking applied files in the schema_migrations table.
 * (Section 8, rule 7: every schema change goes through a migration file,
 * never the Supabase dashboard.)
 * Each file runs inside one transaction — applied fully or not at all.
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import 'dotenv/config';
import pg from 'pg';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));
const { Client } = pg;

/**
 * Reads DATABASE_URL straight from the process environment before any
 * connection attempt. Railway runs this script in preDeploy; we want an
 * explicit failure when its variables are missing rather than a misleading
 * connection attempt against localhost.
 * @returns {string}
 */
function readDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error(
      '[migrate] DATABASE_URL is missing or empty. Add it under Railway -> Service -> Variables before redeploying.',
    );
    console.error('[migrate] Refusing to fall back to a default or localhost database.');
    process.exit(1);
  }
  return databaseUrl;
}

/**
 * Logs the connection target without exposing the password.
 * @param {string} databaseUrl
 */
function logDatabaseTarget(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    console.log(
      `[migrate] DATABASE_URL found. Connecting to ${parsed.hostname}:${parsed.port || '5432'}/${parsed.pathname.replace(/^\//, '')}`,
    );
  } catch {
    console.log('[migrate] DATABASE_URL found, but the target could not be parsed for logging.');
  }
}

/** Ensures the migration tracking table exists. */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text        PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
}

/** @returns {Promise<Set<string>>} Filenames applied previously. */
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
      .sort(); // Numeric prefixes (001, 002, ...) define the apply order.

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skipped (already applied): ${file}`);
        continue;
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate] applied: ${file}`);
        count += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Failed to apply ${file}: ${err.message}`, { cause: err });
      }
    }
    console.log(count === 0 ? '[migrate] no new migrations.' : `[migrate] done: ${count} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
