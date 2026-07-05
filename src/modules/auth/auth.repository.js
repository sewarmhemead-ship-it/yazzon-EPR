/**
 * auth.repository.js
 * Layer: repository — SQL for authentication only. No business logic.
 * All SQL is hand-written and parameterized via node-postgres (section 2).
 */

import { query } from '../../config/db.js';

/**
 * Fetches a user by id (same id as Supabase Auth) to resolve the role for
 * RBAC. Only the columns the middleware needs are selected.
 * @param {string} id User id (uuid, the token's `sub` claim).
 * @returns {Promise<{ id: string, name: string, email: string, role: string } | null>}
 */
export async function findUserById(id) {
  const { rows } = await query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}
