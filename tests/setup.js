/**
 * setup.js
 * Test environment bootstrap (CLAUDE.md section 9), run before every test
 * file via vitest setupFiles.
 *
 * Environment variables must be set before the first import of env.js —
 * that is why this lives in setupFiles rather than inside the tests.
 */

process.env.NODE_ENV = 'test';
// Dedicated test database (section 9). The placeholder value is enough for
// suites that mock the repository layer.
process.env.TEST_DATABASE_URL ??= 'postgresql://test:test@localhost:5432/inventory_test';
// Fixed signing secret for tests only — test tokens are signed with it and
// verified by the auth middleware.
process.env.SUPABASE_JWT_SECRET ??= 'test-jwt-secret-do-not-use-in-prod';
process.env.PORT ??= '3000';
