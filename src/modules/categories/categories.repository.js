/**
 * categories.repository.js
 * Layer: repository — SQL for categories only. No business logic.
 * All SQL is hand-written and parameterized via node-postgres (section 2).
 */

import { query } from '../../config/db.js';

/**
 * Lists all categories ordered by name.
 * @returns {Promise<object[]>}
 */
export async function listCategories() {
  const { rows } = await query('SELECT * FROM categories ORDER BY name ASC');
  return rows;
}

/**
 * Creates a category.
 * @param {string} name Category name.
 * @returns {Promise<object>} The created row.
 */
export async function createCategory(name) {
  const { rows } = await query(
    'INSERT INTO categories (name) VALUES ($1) RETURNING *',
    [name],
  );
  return rows[0];
}
