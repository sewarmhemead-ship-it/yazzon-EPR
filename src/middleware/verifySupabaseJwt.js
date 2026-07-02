/**
 * verifySupabaseJwt.js
 * الطبقة: middleware helper — تحقق محلي من JWT الصادر من Supabase.
 * يدعم:
 *   - HS256 عبر SUPABASE_JWT_SECRET (النظام القديم).
 *   - ES256/RS256 عبر JWKS public keys (النظام الحديث).
 */

import { createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../shared/errors.js';

const HS_ALGORITHMS = ['HS256'];
const JWKS_ALGORITHMS = ['ES256', 'RS256'];
const JWKS_CACHE_MS = 10 * 60 * 1000;

let jwksCache = null;
let jwksFetchedAt = 0;

/**
 * يتحقق من JWT ويعيد payload بعد التحقق من التوقيع.
 * @param {string} token
 * @returns {Promise<object>}
 * @throws {UnauthorizedError}
 */
export async function verifySupabaseJwt(token) {
  const decoded = jwt.decode(token, { complete: true });
  const alg = decoded?.header?.alg;
  const kid = decoded?.header?.kid;

  if (!alg) {
    throw new UnauthorizedError('توكن غير صالح أو منتهٍ');
  }

  if (HS_ALGORITHMS.includes(alg)) {
    if (!env.supabaseJwtSecret) {
      throw new UnauthorizedError('توكن غير صالح أو منتهٍ');
    }
    return verifyWithKey(token, env.supabaseJwtSecret, HS_ALGORITHMS);
  }

  if (JWKS_ALGORITHMS.includes(alg)) {
    if (!kid) {
      throw new UnauthorizedError('توكن غير صالح أو منتهٍ');
    }
    const jwk = await findJwkByKid(kid);
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    return verifyWithKey(token, publicKey, [alg]);
  }

  throw new UnauthorizedError('توكن غير صالح أو منتهٍ');
}

function verifyWithKey(token, key, algorithms) {
  try {
    return jwt.verify(token, key, { algorithms });
  } catch {
    throw new UnauthorizedError('توكن غير صالح أو منتهٍ');
  }
}

async function findJwkByKid(kid) {
  const jwks = await loadJwks();
  const jwk = jwks.keys?.find((key) => key.kid === kid);
  if (!jwk) {
    throw new UnauthorizedError('توكن غير صالح أو منتهٍ');
  }
  return jwk;
}

async function loadJwks() {
  if (env.supabaseJwksJson) {
    return parseJwks(env.supabaseJwksJson);
  }

  const now = Date.now();
  if (jwksCache && now - jwksFetchedAt < JWKS_CACHE_MS) {
    return jwksCache;
  }

  if (!env.supabaseJwksUrl) {
    throw new UnauthorizedError('توكن غير صالح أو منتهٍ');
  }

  const res = await fetch(env.supabaseJwksUrl);
  if (!res.ok) {
    throw new UnauthorizedError('توكن غير صالح أو منتهٍ');
  }
  const jwks = await res.json();
  jwksCache = jwks;
  jwksFetchedAt = now;
  return jwks;
}

function parseJwks(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new UnauthorizedError('توكن غير صالح أو منتهٍ');
  }
}
