/**
 * database.js
 * Test helper — prepares the real test database for integration suites.
 * Applies every migration in order so tests always run against the current
 * schema, not just the initial one.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { pool } from '../../src/config/db.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

/**
 * Probes TEST_DATABASE_URL with a short timeout.
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
 * Locally: logs why database suites are being skipped. In CI: fails hard so
 * the quality gate can never pass without the integration tests.
 * @param {string} label Suite name.
 * @param {string} message Explanation.
 */
export function handleMissingTestDatabase(label, message) {
  const text = `[${label}] TEST_DATABASE_URL is not reachable — ${message}`;
  if (process.env.CI === 'true') {
    throw new Error(`${text} Database suites must not be skipped in CI.`);
  }
  console.warn(`\n${text}\n`);
}

/**
 * Rebuilds the test schema from scratch by applying every numbered migration.
 * Any new migration is therefore exercised by CI immediately.
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

/** Clears test data while keeping the schema intact. */
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
