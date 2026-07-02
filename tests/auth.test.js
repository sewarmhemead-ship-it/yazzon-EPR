/**
 * auth.test.js
 * اختبارات المرحلة 2: المصادقة (JWT) و RBAC — تغطّي الاختبار الإلزامي #10 (القسم 9).
 * نموّه auth.repository حتى لا نحتاج قاعدة بيانات حيّة؛ نتحقّق من منطق الـ middleware فقط.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'node:crypto';

// دالة موّهة مرفوعة (hoisted) ليستعملها vi.mock بأمان قبل تعريف المتغيرات العادية.
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

/** يوقّع توكن اختبار صالحاً لهوية معيّنة. */
function tokenFor(sub) {
  return jwt.sign({ sub }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

/** يوقّع توكن اختبار ES256 كما تفعل مشاريع Supabase الحديثة عبر JWKS. */
function es256TokenFor(sub) {
  return jwt.sign({ sub }, es256PrivateKey, {
    algorithm: 'ES256',
    expiresIn: '1h',
    keyid: ES256_KID,
  });
}

/** تطبيق صغير لاختبار RBAC على مسار admin-only. */
function buildAdminApp() {
  const a = express();
  a.get('/admin-only', requireAuth, requireRole('admin'), (_req, res) =>
    res.json({ ok: true }),
  );
  a.use(errorHandler);
  return a;
}

const ADMIN = { id: 'a1', name: 'مدير', email: 'admin@x.com', role: 'admin' };
const STAFF = { id: 's1', name: 'عامل', email: 'staff@x.com', role: 'staff' };

beforeEach(() => {
  findUserByIdMock.mockReset();
});

describe('requireAuth (المصادقة)', () => {
  it('يرفض بلا ترويسة Authorization → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('يرفض ترويسة بلا بادئة Bearer → 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
  });

  it('يرفض توكناً بتوقيع خاطئ → 401', async () => {
    const bad = jwt.sign({ sub: ADMIN.id }, 'wrong-secret', { algorithm: 'HS256' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${bad}`);
    expect(res.status).toBe(401);
    expect(findUserByIdMock).not.toHaveBeenCalled();
  });

  it('يرفض توكناً صالحاً لهوية بلا صفّ في users → 401 (2-ب)', async () => {
    findUserByIdMock.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor('ghost')}`);
    expect(res.status).toBe(401);
    expect(findUserByIdMock).toHaveBeenCalledWith('ghost');
  });

  it('يقبل توكناً صالحاً لمستخدم موجود ويعيد req.user → 200', async () => {
    findUserByIdMock.mockResolvedValue(STAFF);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(STAFF.id)}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(STAFF);
  });

  it('يقبل توكن ES256 عبر JWKS لمشاريع Supabase الحديثة → 200', async () => {
    findUserByIdMock.mockResolvedValue(STAFF);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${es256TokenFor(STAFF.id)}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(STAFF);
  });
});

describe('requireRole (RBAC — الاختبار الإلزامي #10)', () => {
  it('يمنع staff من مسار admin → 403', async () => {
    findUserByIdMock.mockResolvedValue(STAFF);
    const res = await request(buildAdminApp())
      .get('/admin-only')
      .set('Authorization', `Bearer ${tokenFor(STAFF.id)}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('يسمح admin بمسار admin → 200', async () => {
    findUserByIdMock.mockResolvedValue(ADMIN);
    const res = await request(buildAdminApp())
      .get('/admin-only')
      .set('Authorization', `Bearer ${tokenFor(ADMIN.id)}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
