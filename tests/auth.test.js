/**
 * auth.test.js
 * Phase 2 tests: authentication (JWT) and RBAC — covers mandatory test 10
 * (CLAUDE.md section 9). The auth repository is mocked so no live database is
 * needed; only the middleware logic is under test.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'node:crypto';

// Hoisted mock so vi.mock can reference it before regular declarations run.
const { findUserByIdMock } = vi.hoisted(() => ({ findUserByIdMock: vi.fn() }));
vi.mock('../src/modules/auth/auth.repository.js', () => ({
  findUserById: findUserByIdMock,
}));

const ES256_KID = '486de3d8-0ade-4078-87d6-18f503d8968d';
const { privateKey: es256PrivateKey, publicKey: es256PublicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});
const es256PublicJwk = {
  ...es256PublicKey.export({ format: 'jwk' }),
  alg: 'ES256',
  kid: ES256_KID,
  use: 'sig',
  key_ops: ['verify'],
};
process.env.SUPABASE_JWKS_JSON = JSON.stringify({ keys: [es256PublicJwk] });

const { app } = await import('../src/app.js');
const { requireAuth } = await import('../src/middleware/auth.js');
const { requireRole } = await import('../src/middleware/requireRole.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

const SECRET = process.env.SUPABASE_JWT_SECRET;

/** Signs a valid HS256 test token for the given subject. */
function tokenFor(sub) {
  return jwt.sign({ sub }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

/** Signs an ES256 token the way current Supabase projects do (via JWKS). */
function es256TokenFor(sub) {
  return jwt.sign({ sub }, es256PrivateKey, {
    algorithm: 'ES256',
    expiresIn: '1h',
    keyid: ES256_KID,
  });
}

/** Minimal app for exercising RBAC on an admin-only route. */
function buildAdminApp() {
  const a = express();
  a.get('/admin-only', requireAuth, requireRole('admin'), (_req, res) =>
    res.json({ ok: true }),
  );
  a.use(errorHandler);
  return a;
}

const ADMIN = { id: 'a1', name: 'Admin', email: 'admin@x.com', role: 'admin' };
const STAFF = { id: 's1', name: 'Staff', email: 'staff@x.com', role: 'staff' };

beforeEach(() => {
  findUserByIdMock.mockReset();
});

describe('requireAuth (authentication)', () => {
  it('rejects a request without an Authorization header with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a header without the Bearer prefix with 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
  });

  it('rejects a token with a bad signature with 401', async () => {
    const bad = jwt.sign({ sub: ADMIN.id }, 'wrong-secret', { algorithm: 'HS256' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${bad}`);
    expect(res.status).toBe(401);
    expect(findUserByIdMock).not.toHaveBeenCalled();
  });

  it('rejects a valid token whose identity has no users row with 401', async () => {
    findUserByIdMock.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor('ghost')}`);
    expect(res.status).toBe(401);
    expect(findUserByIdMock).toHaveBeenCalledWith('ghost');
  });

  it('accepts a valid token for an existing user and returns req.user with 200', async () => {
    findUserByIdMock.mockResolvedValue(STAFF);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(STAFF.id)}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(STAFF);
  });

  it('accepts an ES256 token via JWKS (current Supabase projects) with 200', async () => {
    findUserByIdMock.mockResolvedValue(STAFF);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${es256TokenFor(STAFF.id)}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(STAFF);
  });
});

describe('requireRole (RBAC — mandatory test 10)', () => {
  it('blocks staff from an admin route with 403', async () => {
    findUserByIdMock.mockResolvedValue(STAFF);
    const res = await request(buildAdminApp())
      .get('/admin-only')
      .set('Authorization', `Bearer ${tokenFor(STAFF.id)}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows admin through an admin route with 200', async () => {
    findUserByIdMock.mockResolvedValue(ADMIN);
    const res = await request(buildAdminApp())
      .get('/admin-only')
      .set('Authorization', `Bearer ${tokenFor(ADMIN.id)}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
