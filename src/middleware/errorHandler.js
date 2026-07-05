/**
 * errorHandler.js
 * Layer: middleware — central error handler (last in the chain).
 * Converts errors thrown anywhere into uniform HTTP responses (section 6,
 * rule 5). Nothing is swallowed: unexpected errors are logged in full and
 * returned as a generic 500 without leaking internals.
 */

import { AppError, errorBody } from '../shared/errors.js';

/** Default response for unexpected failures. */
const INTERNAL_ERROR = Object.freeze({
  statusCode: 500,
  code: 'INTERNAL_ERROR',
  message: 'An unexpected internal error occurred',
});

/**
 * Express error handler. The four-parameter signature is required for Express
 * to recognize it as an error handler, even though `next` goes unused.
 * @param {unknown} err
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, _req, res, _next) {
  // Expected domain errors carry their own status and code.
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(errorBody(err.code, err.message));
  }

  // Anything else is a programming error: log it fully, respond generically.
  console.error('[errorHandler] unexpected error:', err);
  return res
    .status(INTERNAL_ERROR.statusCode)
    .json(errorBody(INTERNAL_ERROR.code, INTERNAL_ERROR.message));
}
