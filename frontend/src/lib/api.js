/**
 * api.js — fetch wrapper for the backend API.
 * Attaches the Supabase bearer token from the current session and converts
 * backend errors (uniform { error: { code, message } } shape) into ApiError
 * instances carrying a German user-facing message resolved from the code.
 */

import { supabase } from './supabase.js';

// In production Express serves the built frontend, so /api shares the domain
// (Railway). In development the Vite proxy forwards /api to the backend.
const API_URL = import.meta.env.VITE_API_URL ?? '/api';

/**
 * German messages by backend error code. The backend's `message` field is
 * developer-facing English; users only ever see these.
 */
const ERROR_MESSAGES = {
  NOT_FOUND: 'Nicht gefunden.',
  VALIDATION_ERROR: 'Ungültige Eingabe. Bitte prüfen und erneut versuchen.',
  INSUFFICIENT_STOCK: 'Der Bestand reicht dafür nicht aus.',
  UNAUTHORIZED: 'Anmeldung erforderlich oder abgelaufen.',
  FORBIDDEN: 'Keine Berechtigung für diese Aktion.',
  INTERNAL_ERROR: 'Unerwarteter Fehler. Bitte erneut versuchen.',
};

const FALLBACK_MESSAGE = 'Anfrage fehlgeschlagen. Bitte erneut versuchen.';

/** API error carrying the backend code and the HTTP status. */
export class ApiError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** Returns the current access token from the Supabase session, if any. */
async function getAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Performs a backend request with token attachment and error mapping.
 * @param {string} path Relative path (e.g. '/items').
 * @param {object} [options] { method, body }.
 * @returns {Promise<any>} Parsed JSON body on success.
 * @throws {ApiError} On a non-2xx response.
 */
async function request(path, { method = 'GET', body } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(ERROR_MESSAGES[err.code] ?? FALLBACK_MESSAGE, {
      code: err.code,
      status: res.status,
    });
  }
  return data;
}

/** Typed surface over the endpoints the frontend uses. */
export const api = {
  me: () => request('/auth/me'),

  listItems: () => request('/items'),
  createItem: (data) => request('/items', { method: 'POST', body: data }),
  updateItem: (itemId, data) => request(`/items/${itemId}`, { method: 'PATCH', body: data }),

  listCategories: () => request('/categories'),
  createCategory: (name) => request('/categories', { method: 'POST', body: { name } }),

  listLocations: () => request('/locations'),
  createLocation: (name, position) =>
    request('/locations', { method: 'POST', body: { name, position } }),

  listTransactions: (filters = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    const qs = params.toString();
    return request(`/transactions${qs ? `?${qs}` : ''}`);
  },

  receive: (itemId, quantity, note) =>
    request('/transactions/receive', { method: 'POST', body: { itemId, quantity, note } }),
  consume: (itemId, quantity, type, note) =>
    request('/transactions/consume', { method: 'POST', body: { itemId, quantity, type, note } }),
  adjust: (itemId, delta, note) =>
    request('/transactions/adjust', { method: 'POST', body: { itemId, delta, note } }),
  undo: (transactionId) =>
    request(`/transactions/${transactionId}/undo`, { method: 'POST' }),

  listAlerts: () => request('/alerts'),
  markOrdered: (itemId) => request(`/alerts/${itemId}/ordered`, { method: 'POST' }),
  unmarkOrdered: (itemId) => request(`/alerts/${itemId}/ordered`, { method: 'DELETE' }),
};
