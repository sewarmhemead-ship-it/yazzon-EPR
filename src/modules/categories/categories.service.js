/**
 * categories.service.js
 * Layer: service — category business logic (input validation).
 */

import { assertNonEmptyString } from '../../shared/validate.js';
import { listCategories, createCategory } from './categories.repository.js';

/**
 * Returns all categories.
 * @returns {Promise<object[]>}
 */
export async function getCategories() {
  return listCategories();
}

/**
 * Creates a category after validating its name.
 * @param {string} name
 * @returns {Promise<object>}
 * @throws {ValidationError} For an empty name.
 */
export async function addCategory(name) {
  const clean = assertNonEmptyString(name, 'name');
  return createCategory(clean);
}
