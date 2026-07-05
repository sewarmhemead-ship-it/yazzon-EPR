/**
 * locations.repository.js
 * Layer: repository — SQL for storage locations (fridges) only. No business logic.
 * All SQL is hand-written and parameterized via node-postgres (section 2).
 */

import { query } from '../../config/db.js';

/**
 * Lists all locations in display order.
 * @returns {Promise<object[]>}
 */
export async function listLocations() {
  const { rows } = await query('SELECT * FROM locations ORDER BY position ASC, name ASC');
  return rows;
}

/**
 * Creates a location.
 * @param {string} name Location name (e.g. "Kühlschrank 13").
 * @param {number} position Display order.
 * @returns {Promise<object>}
 */
export async function createLocation(name, position) {
  const { rows } = await query(
    'INSERT INTO locations (name, position) VALUES ($1, $2) RETURNING *',
    [name, position],
  );
  return rows[0];
}
