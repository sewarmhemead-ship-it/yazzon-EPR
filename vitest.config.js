/**
 * vitest.config.js
 * Test setup (CLAUDE.md section 9). setupFiles configures the environment
 * before any module that reads env is loaded. File parallelism is disabled
 * because the database-backed suites share one schema.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    globalTeardown: ['./tests/globalTeardown.js'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
