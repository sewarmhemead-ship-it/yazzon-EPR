/**
 * errors.js
 * Layer: shared — domain error classes.
 * Services throw these; the central errorHandler converts them to HTTP
 * responses (section 6, rule 5: no try/catch may swallow errors silently).
 * Clients localize by `code`; `message` is for developers and logs.
 */

/**
 * Base class for all expected application errors (business failures, not bugs).
 * @property {number} statusCode HTTP status to respond with.
 * @property {string} code Stable machine-readable code for clients and tests.
 */
export class AppError extends Error {
  /**
   * @param {string} message Developer-facing description.
   * @param {number} statusCode HTTP status.
   * @param {string} code Stable machine-readable code.
   */
  constructor(message, statusCode, code) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    // Distinguishes expected (operational) errors from programming bugs.
    this.isOperational = true;
  }
}

/** Resource not found → 404. */
export class NotFoundError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** Invalid request input → 400. */
export class ValidationError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Invalid input') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/**
 * Not enough stock to complete a withdrawal → 409.
 * Thrown when the atomic conditional UPDATE returns zero rows [INV-1].
 */
export class InsufficientStockError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Insufficient stock for this operation') {
    super(message, 409, 'INSUFFICIENT_STOCK');
  }
}

/** Unauthenticated → 401. */
export class UnauthorizedError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** Authenticated but not allowed → 403 (RBAC). */
export class ForbiddenError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Not allowed to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Builds the uniform HTTP error body so its shape lives in exactly one place.
 * @param {string} code Stable machine-readable code.
 * @param {string} message Human-readable message.
 * @returns {{ error: { code: string, message: string } }}
 */
export function errorBody(code, message) {
  return { error: { code, message } };
}
