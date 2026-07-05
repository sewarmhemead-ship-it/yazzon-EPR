/**
 * app.js
 * Layer: composition — builds the Express app and wires middleware + modules.
 * Assembly only; no business logic. The app is exported without listening so
 * supertest can drive it directly (CLAUDE.md section 9).
 *
 * The central errorHandler must always stay last, after every route.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './middleware/errorHandler.js';
import { errorBody } from './shared/errors.js';
import { env } from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import transactionsRoutes from './modules/transactions/transactions.routes.js';
import alertsRoutes from './modules/alerts/alerts.routes.js';
import itemsRoutes from './modules/items/items.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import locationsRoutes from './modules/locations/locations.routes.js';

export const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, '../frontend/dist');
const frontendIndex = path.join(frontendDist, 'index.html');

// Allow the frontend origins (Vite dev server) with the Authorization header.
app.use(cors({ origin: env.corsOrigins }));

app.use(express.json());

// Liveness probe; does not touch the database.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Development-only login that mints JWTs for the demo accounts.
// Never mounted unless DEMO_MODE=true (local demos with the in-memory DB).
if (process.env.DEMO_MODE === 'true') {
  const DEMO_ACCOUNTS = {
    'admin@demo.com': { id: '11111111-1111-1111-1111-111111111111', role: 'admin' },
    'staff@demo.com': { id: '22222222-2222-2222-2222-222222222222', role: 'staff' },
  };
  const DEMO_PASSWORD = 'demo';

  app.post('/api/demo/login', (req, res) => {
    const { email, password } = req.body ?? {};
    const account = DEMO_ACCOUNTS[email];
    // Unknown emails and wrong passwords are rejected, mirroring real auth.
    if (!account || password !== DEMO_PASSWORD) {
      return res
        .status(401)
        .json(errorBody('UNAUTHORIZED', 'E-Mail oder Passwort falsch'));
    }
    const token = jwt.sign(
      { sub: account.id, email, user_metadata: { role: account.role } },
      env.supabaseJwtSecret,
      { expiresIn: '8h' },
    );
    res.json({ access_token: token, user: { id: account.id, role: account.role, email } });
  });
}

// Feature modules.
app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/alerts', alertsRoutes);

// In production Express also serves the built React frontend, so the whole
// app runs as a single service (Railway) on one domain.
if (env.nodeEnv === 'production' && existsSync(frontendIndex)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    return res.sendFile(frontendIndex);
  });
}

// Unknown route → uniform 404 body.
app.use((_req, res) => {
  res.status(404).json(errorBody('NOT_FOUND', 'Route not found'));
});

// Central error handler — must remain the last middleware (section 6, rule 5).
app.use(errorHandler);
