/**
 * vitest.config.js
 * إعداد الاختبارات (القسم 9). setupFiles يضبط بيئة الاختبار قبل تحميل أي وحدة تقرأ env.
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
