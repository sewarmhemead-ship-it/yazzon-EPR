/**
 * env.js
 * Layer: config — loads .env and validates every required variable.
 * Single trusted source for all settings; fails fast at boot if a secret is
 * missing (CLAUDE.md section 2: no secret is ever hard-coded).
 */

import 'dotenv/config';

/** Test runs use a separate database (CLAUDE.md section 9). */
const TEST_ENV = 'test';

/**
 * Reads a required variable, throwing a clear error when missing or empty,
 * so misconfiguration surfaces at boot rather than on the first request.
 * @param {string} name Environment variable name.
 * @returns {string} Trimmed value.
 * @throws {Error} When the variable is undefined or blank.
 */
function required(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name} — see .env.example`);
  }
  return value.trim();
}

/**
 * Reads an optional variable, returning null when missing or empty.
 * @param {string} name Environment variable name.
 * @returns {string|null}
 */
function optional(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return null;
  }
  return value.trim();
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

// Tests must run against the dedicated test database so development and
// production data are never touched.
const databaseUrl =
  nodeEnv === TEST_ENV ? required('TEST_DATABASE_URL') : required('DATABASE_URL');

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`Invalid PORT: "${process.env.PORT}" — must be a positive integer`);
}

// Supabase Auth settings. Newer Supabase projects sign tokens with
// ES256 via JWKS; legacy projects use a shared HS256 JWT secret.
const supabaseUrl = optional('SUPABASE_URL');
const supabaseJwtSecret = optional('SUPABASE_JWT_SECRET');
const supabaseJwksUrl =
  optional('SUPABASE_JWKS_URL') ||
  (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json` : null);
const supabaseJwksJson = optional('SUPABASE_JWKS_JSON');

if (!supabaseJwtSecret && !supabaseJwksUrl && !supabaseJwksJson) {
  throw new Error(
    'One of SUPABASE_JWT_SECRET, SUPABASE_JWKS_URL or SUPABASE_JWKS_JSON is required to verify Supabase tokens',
  );
}

// Frontend origins allowed by CORS. Accepts a comma-separated list because
// Vite may serve on localhost or 127.0.0.1 during development.
const corsOrigin = process.env.CORS_ORIGIN?.trim() || 'http://localhost:5173,http://127.0.0.1:5173';
const corsOrigins = corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Application settings, frozen to prevent accidental mutation at runtime.
 * @type {Readonly<{ nodeEnv: string, isTest: boolean, port: number, databaseUrl: string, supabaseUrl: string|null, supabaseJwtSecret: string|null, supabaseJwksUrl: string|null, supabaseJwksJson: string|null, corsOrigin: string, corsOrigins: string[] }>}
 */
export const env = Object.freeze({
  nodeEnv,
  isTest: nodeEnv === TEST_ENV,
  port,
  databaseUrl,
  supabaseUrl,
  supabaseJwtSecret,
  supabaseJwksUrl,
  supabaseJwksJson,
  corsOrigin,
  corsOrigins,
});
