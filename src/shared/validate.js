/**
 * validate.js
 * Layer: shared — request input validation and normalization.
 * Rejects bad input early with ValidationError (mapped to HTTP 400).
 *
 * [INV-4] Quantities are numeric with no rounding: values are validated as
 * decimal strings and passed through to PostgreSQL as-is. They are never
 * converted to JS Number for arithmetic (0.1 + 0.2 precision loss) — all
 * quantity math happens in the database's numeric type.
 */

import { ValidationError } from './errors.js';

/** Positive decimal: integer or fraction, no sign. */
const POSITIVE_DECIMAL = /^\d+(\.\d+)?$/;
/** Signed decimal: allows a leading minus (used for adjustments). */
const SIGNED_DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * Asserts the value is a valid positive quantity and returns it as a decimal
 * string, preserving numeric precision end-to-end [INV-4].
 * @param {unknown} value Raw request value.
 * @param {string} field Field name for the error message.
 * @returns {string} Positive decimal string.
 * @throws {ValidationError} When not a valid positive number.
 */
export function assertPositiveQuantity(value, field) {
  const str = typeof value === 'number' ? String(value) : value;
  if (typeof str !== 'string' || !POSITIVE_DECIMAL.test(str.trim())) {
    throw new ValidationError(`${field} must be a valid positive number`);
  }
  const normalized = str.trim();
  if (Number(normalized) <= 0) {
    throw new ValidationError(`${field} must be greater than zero`);
  }
  return normalized;
}

/**
 * Asserts the value is a signed, non-zero quantity (for adjustments) and
 * returns it as a decimal string. Zero is rejected because a zero movement is
 * meaningless and violates the database check constraint.
 * @param {unknown} value Raw request value.
 * @param {string} field Field name for the error message.
 * @returns {string} Signed decimal string (may start with "-").
 * @throws {ValidationError} When not a valid number or when zero.
 */
export function assertSignedNonZeroQuantity(value, field) {
  const str = typeof value === 'number' ? String(value) : value;
  if (typeof str !== 'string' || !SIGNED_DECIMAL.test(str.trim())) {
    throw new ValidationError(`${field} must be a valid number`);
  }
  const normalized = str.trim();
  if (Number(normalized) === 0) {
    throw new ValidationError(`${field} must not be zero`);
  }
  return normalized;
}

/**
 * Asserts the value is a non-empty string and returns it trimmed.
 * @param {unknown} value Raw request value.
 * @param {string} field Field name for the error message.
 * @returns {string}
 * @throws {ValidationError} When empty or not a string.
 */
export function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${field} is required`);
  }
  return value.trim();
}
