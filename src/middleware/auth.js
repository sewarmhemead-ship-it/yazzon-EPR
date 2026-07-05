/**
 * auth.js
 * Layer: middleware — authenticates requests via Supabase-issued JWTs.
 * Verifies the token locally (HS256 secret or JWKS, see verifySupabaseJwt),
 * loads the matching users row, and attaches it as req.user.
 *
 * Design decisions:
 *   - The user must already exist in the users table; a valid token without a
 *     matching row is rejected with 401 (no just-in-time provisioning).
 *   - Authorization is enforced here and in requireRole — RLS is disabled
 *     (CLAUDE.md section 2), so Express is the only gatekeeper.
 */

import { UnauthorizedError } from '../shared/errors.js';
import { findUserById } from '../modules/auth/auth.repository.js';
import { verifySupabaseJwt } from './verifySupabaseJwt.js';

/** Authorization header scheme prefix. */
const BEARER_PREFIX = 'Bearer ';

/**
 * Verifies the request token and loads the user onto req.user.
 * Async, so errors are forwarded via next(err) — Express 4 does not catch
 * rejections from async middleware on its own.
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedError('Missing authentication token');
    }
    const token = header.slice(BEARER_PREFIX.length).trim();

    let payload;
    try {
      payload = await verifySupabaseJwt(token);
    } catch {
      // Do not leak the failure reason (expired vs bad signature) to the client.
      throw new UnauthorizedError('Invalid or expired token');
    }

    const userId = payload.sub;
    if (!userId) {
      throw new UnauthorizedError('Token has no subject');
    }

    // The identity must map to an existing users row; nothing is auto-created.
    const user = await findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('Unknown user');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
