/**
 * api.js — غلاف fetch للتواصل مع الـ backend.
 * يرفق توكن Supabase (Bearer) تلقائياً من الجلسة الحالية، ويحوّل أخطاء الـ backend
 * إلى استثناءات تحمل الرمز والرسالة (بصيغة { error: { code, message } } الموحّدة).
 */

import { supabase } from './supabase.js';

// في الإنتاج تُخدَم الواجهة من Express نفسه، لذلك /api تعمل على نفس الدومين (Railway).
// في التطوير يمرر Vite هذه الطلبات إلى backend عبر proxy في vite.config.js.
const API_URL = import.meta.env.VITE_API_URL ?? '/api';

/** خطأ API يحمل رمز الـ backend ورمز HTTP. */
export class ApiError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** يعيد توكن الوصول الحالي من جلسة Supabase، أو null إن لم يوجد. */
async function getAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * ينفّذ طلباً إلى الـ backend مع إرفاق التوكن ومعالجة الأخطاء.
 * @param {string} path مسار نسبي (مثل '/items').
 * @param {object} [options] { method, body }.
 * @returns {Promise<any>} جسم الرد (JSON) عند النجاح.
 * @throws {ApiError} عند رد غير ناجح.
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
    throw new ApiError(err.message ?? 'Anfrage fehlgeschlagen', {
      code: err.code,
      status: res.status,
    });
  }
  return data;
}

/** واجهة مختصرة لنقاط النهاية المستخدمة في الواجهة. */
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
