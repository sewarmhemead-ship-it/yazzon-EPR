/**
 * verifySupabaseJwt.js
 * Layer: middleware helper — local verification of Supabase-issued JWTs.
 * Supports both signing schemes:
 *   - HS256 with SUPABASE_JWT_SECRET (legacy projects).
 *   - ES256/RS256 with JWKS public keys (current projects).
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

/** Single generic failure so callers never leak why verification failed. */
const invalidToken = () => new UnauthorizedError('Invalid or expired token');

/**
 * Verifies a JWT and returns its payload.
 * @param {string} token
 * @returns {Promise<object>}
 * @throws {UnauthorizedError}
 */
export async function verifySupabaseJwt(token) {
  const decoded = jwt.decode(token, { complete: true });
  const alg = decoded?.header?.alg;
  const kid = decoded?.header?.kid;

  if (!alg) {
    throw invalidToken();
  }

  if (HS_ALGORITHMS.includes(alg)) {
    if (!env.supabaseJwtSecret) {
      throw invalidToken();
    }
    return verifyWithKey(token, env.supabaseJwtSecret, HS_ALGORITHMS);
  }

  if (JWKS_ALGORITHMS.includes(alg)) {
    if (!kid) {
      throw invalidToken();
    }
    const jwk = await findJwkByKid(kid);
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    return verifyWithKey(token, publicKey, [alg]);
  }

  throw invalidToken();
}

function verifyWithKey(token, key, algorithms) {
  try {
    return jwt.verify(token, key, { algorithms });
  } catch {
    throw invalidToken();
  }
}

async function findJwkByKid(kid) {
  const jwks = await loadJwks();
  const jwk = jwks.keys?.find((key) => key.kid === kid);
  if (!jwk) {
    throw invalidToken();
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
    throw invalidToken();
  }

  const res = await fetch(env.supabaseJwksUrl);
  if (!res.ok) {
    throw invalidToken();
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
    throw invalidToken();
  }
}
