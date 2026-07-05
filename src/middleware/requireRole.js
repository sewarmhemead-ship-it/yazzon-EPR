/**
 * requireRole.js
 * Layer: middleware — role-based access control (RBAC).
 * Restricts a route to the given roles; must run after requireAuth.
 * (CLAUDE.md section 2: authorization lives in Express — RLS is disabled.)
 */

import { ForbiddenError, UnauthorizedError } from '../shared/errors.js';

/**
 * Middleware factory limiting access to the allowed roles. Kept separate from
 * requireAuth so "who are you" and "may you do this" stay independent and the
 * rule can be reused on any admin route without duplicating checks.
 * @param {...string} allowedRoles Roles permitted through (e.g. 'admin').
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    // requireAuth must have run first and populated req.user.
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}
