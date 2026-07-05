/**
 * locations.service.js
 * Layer: service — storage location business logic (input validation).
 */

import { assertNonEmptyString } from '../../shared/validate.js';
import { listLocations, createLocation } from './locations.repository.js';

/** Returns all locations. */
export async function getLocations() {
  return listLocations();
}

/**
 * Creates a location after validation.
 * @param {string} name
 * @param {number} [position]
 */
export async function addLocation(name, position = 0) {
  const clean = assertNonEmptyString(name, 'name');
  const pos = Number.isFinite(Number(position)) ? Number(position) : 0;
  return createLocation(clean, pos);
}
