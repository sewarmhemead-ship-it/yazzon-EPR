/**
 * format.js — أدوات عرض للكميات وحالة المخزون.
 * الكميات نصوص numeric من الـ backend؛ التحويل إلى Number هنا للعرض فقط [INV-4].
 */

/**
 * يطبّع مدخل كمية من المستخدم: فاصلة ألمانية "2,5" → "2.5"، مع قصّ الفراغات.
 * (لوحات المفاتيح النمساوية/الألمانية تكتب الفاصلة — بدون هذا يُرفض كل إدخال كسري.)
 * @param {string} value
 * @returns {string}
 */
export function normalizeDecimalInput(value) {
  return String(value ?? '').trim().replace(',', '.');
}

/** نمط رقم عشري موجب (مطابق لتحقّق الـ backend). */
export const POSITIVE_DECIMAL = /^\d+(\.\d+)?$/;

/**
 * يعرض رقماً بلا ضجيج float (يقصّ إلى 3 منازل ويزيل الأصفار الزائدة).
 * مثال: 1.2000000000000002 → "1.2".
 * @param {number|string} value
 * @returns {string}
 */
export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return String(Math.round(n * 1000) / 1000);
}

/** يعرض كمية نصية كما هي (مع تنظيف بسيط). */
export function formatQty(value) {
  return formatNumber(String(value ?? '').trim());
}

/**
 * حالة المخزون:
 *   'ordered'  — عند/تحت الحد لكنه مطلوب (القسم 7).
 *   'critical' — عند/تحت الحد ولم يُطلَب.
 *   'low'      — ≤ ضعف الحد.
 *   'ok'       — كافٍ.
 * @param {{current_stock: string, min_stock_level: string, is_ordered: boolean}} item
 */
export function stockStatus(item) {
  const current = Number(item.current_stock);
  const min = Number(item.min_stock_level);
  if (current <= min) return item.is_ordered ? 'ordered' : 'critical';
  if (current <= min * 2) return 'low';
  return 'ok';
}

/** التسمية الألمانية لحالة المخزون. */
export const STATUS_LABEL = {
  ordered: 'Bestellt',
  critical: 'Kritisch',
  low: 'Niedrig',
  ok: 'Ausreichend',
};

/** أصناف شارة الحالة (خلفية ناعمة + نص بلون الحالة). */
export const STATUS_BADGE = {
  ok: 'bg-ok-soft text-ok',
  low: 'bg-warn-soft text-warn',
  ordered: 'bg-warn-soft text-warn',
  critical: 'bg-critical-soft text-critical',
};

/** ترتيب شدّة الحالة (للفرز: الأشد أولاً). */
export const STATUS_RANK = { critical: 0, ordered: 1, low: 2, ok: 3 };

/** تسميات أنواع الحركات (سجل Verlauf). */
export const TX_LABEL = {
  in: 'Eingang',
  out: 'Entnahme',
  waste: 'Verlust',
  adjustment: 'Korrektur',
};

/** ألوان أنواع الحركات: شارة ناعمة + لون كمية. */
export const TX_BADGE = {
  in: 'bg-ok-soft text-ok',
  out: 'bg-crust-soft text-crust-dark',
  waste: 'bg-critical-soft text-critical',
  adjustment: 'bg-warn-soft text-warn',
};

/**
 * يعرض وقتاً بتوقيت Europe/Vienna [INV-5] بصيغة ألمانية قصيرة.
 * @param {string} iso timestamptz من الـ backend.
 * @returns {string} مثل "02.07., 14:30".
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
