/**
 * globalTeardown.js
 * Test config — closes the database pool once after all Vitest files finish.
 */

export default async function globalTeardown() {
  const { pool } = await import('../src/config/db.js');
  await pool.end();
}
