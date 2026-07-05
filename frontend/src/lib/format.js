/**
 * format.js — display helpers for quantities and stock status.
 * Quantities arrive as numeric strings from the backend; converting to Number
 * here is for display only, never for stored arithmetic [INV-4].
 */

/**
 * Normalizes user quantity input: German decimal comma ("2,5") becomes "2.5",
 * whitespace is trimmed. Austrian/German keyboards type the comma — without
 * this every fractional entry would be rejected.
 * @param {string} value
 * @returns {string}
 */
export function normalizeDecimalInput(value) {
  return String(value ?? '').trim().replace(',', '.');
}

/** Positive decimal pattern (mirrors the backend validation). */
export const POSITIVE_DECIMAL = /^\d+(\.\d+)?$/;

/**
 * Renders a number without float noise (rounded to 3 decimals, trailing
 * zeros dropped). Example: 1.2000000000000002 renders as "1.2".
 * @param {number|string} value
 * @returns {string}
 */
export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return String(Math.round(n * 1000) / 1000);
}

/** Renders a quantity string for display. */
export function formatQty(value) {
  return formatNumber(String(value ?? '').trim());
}

/**
 * Stock status of an item:
 *   'ordered'  — at/below minimum but already ordered (section 7).
 *   'critical' — at/below minimum, not ordered yet.
 *   'low'      — within twice the minimum.
 *   'ok'       — sufficient.
 * @param {{current_stock: string, min_stock_level: string, is_ordered: boolean}} item
 */
export function stockStatus(item) {
  const current = Number(item.current_stock);
  const min = Number(item.min_stock_level);
  if (current <= min) return item.is_ordered ? 'ordered' : 'critical';
  if (current <= min * 2) return 'low';
  return 'ok';
}

/** German labels for stock status. */
export const STATUS_LABEL = {
  ordered: 'Bestellt',
  critical: 'Kritisch',
  low: 'Niedrig',
  ok: 'Ausreichend',
};

/** Status badge classes (soft background + status-colored text). */
export const STATUS_BADGE = {
  ok: 'bg-ok-soft text-ok',
  low: 'bg-warn-soft text-warn',
  ordered: 'bg-warn-soft text-warn',
  critical: 'bg-critical-soft text-critical',
};

/** Severity rank for sorting (most urgent first). */
export const STATUS_RANK = { critical: 0, ordered: 1, low: 2, ok: 3 };

/** German labels for movement types (history view). */
export const TX_LABEL = {
  in: 'Eingang',
  out: 'Entnahme',
  waste: 'Verlust',
  adjustment: 'Korrektur',
};

/** Movement type badge classes. */
export const TX_BADGE = {
  in: 'bg-ok-soft text-ok',
  out: 'bg-crust-soft text-crust-dark',
  waste: 'bg-critical-soft text-critical',
  adjustment: 'bg-warn-soft text-warn',
};

/**
 * Formats a timestamp in the Europe/Vienna timezone [INV-5], short German
 * style, e.g. "02.07., 14:30".
 * @param {string} iso timestamptz from the backend.
 * @returns {string}
 */
export function formatDateTime(iso) {
  try {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: 'Europe/Vienna',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return String(iso ?? '');
  }
}
