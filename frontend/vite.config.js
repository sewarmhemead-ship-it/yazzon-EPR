/**
 * vite.config.js — إعداد Vite للواجهة.
 * React + Tailwind v4 (عبر إضافة @tailwindcss/vite). منفذ التطوير 5173 (مطابق CORS في الـ backend).
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
});
