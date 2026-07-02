/**
 * StockMeter.jsx — العنصر المميّز: مقياس تعبئة عليه "خطّ إعادة الطلب" (الحدّ الأدنى).
 * كبطاقة رفّ حقيقية: ترى فوراً أين الرصيد نسبةً إلى الخط، لا مجرد نسبة مجرّدة.
 * المرجع = max(الرصيد الحالي، ضعف الحد) حتى يبقى الخط داخل المدى دائماً.
 */

import { stockStatus } from '../lib/format.js';

const BAR_COLOR = {
  ok: 'bg-ok',
  low: 'bg-warn',
  ordered: 'bg-warn',
  critical: 'bg-critical',
};

export default function StockMeter({ item, tall = false }) {
  const status = stockStatus(item);
  const current = Number(item.current_stock);
  const min = Number(item.min_stock_level);
  const reference = Math.max(current, min * 2, 0.0001);
  const fillPct = Math.max(0, Math.min(100, (current / reference) * 100));
  const minPct = Math.max(0, Math.min(100, (min / reference) * 100));

  return (
    <div className={`relative w-full rounded-full bg-line-soft overflow-visible ${tall ? 'h-2.5' : 'h-1.5'}`}>
      <div
        className={`h-full rounded-full ${BAR_COLOR[status]} transition-[width] duration-300`}
        style={{ width: `${fillPct}%` }}
      />
      {/* خطّ إعادة الطلب — علامة رأسية عند الحدّ الأدنى */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-[calc(100%+6px)] w-0.5 rounded bg-ink-2/70"
        style={{ left: `${minPct}%` }}
        title={`Mindestbestand: ${item.min_stock_level}`}
        aria-hidden="true"
      />
    </div>
  );
}
