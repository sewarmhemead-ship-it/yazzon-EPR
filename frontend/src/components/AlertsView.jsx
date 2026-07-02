/**
 * AlertsView.jsx — شاشة Warnungen: قائمة شراء المدير.
 * مجمّعة: "يجب طلبه" (غير مطلوب، بترتيب النقص من الـ backend) ثم "تم طلبه — بانتظار التوصيلة".
 * عرض النقص بأرقام نظيفة (بلا ضجيج float). تعليم/إلغاء "بستلت" للمدير.
 */

import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { formatQty, formatNumber } from '../lib/format.js';

export default function AlertsView({ notify }) {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { items } = await api.listAlerts();
      setItems(items);
      setError(null);
    } catch (err) {
      setError(err.message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setOrdered(item, value) {
    setBusyId(item.id);
    try {
      if (value) await api.markOrdered(item.id);
      else await api.unmarkOrdered(item.id);
      await load();
      notify(value ? `Als bestellt markiert: ${item.name}` : `Bestell-Markierung entfernt: ${item.name}`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (items === null) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-surface shadow-card animate-pulse" />
        ))}
      </div>
    );
  }
  if (error) return <p className="text-critical p-2">{error}</p>;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-surface shadow-card p-8 text-center">
        <p className="font-semibold text-ok">Alles aufgefüllt.</p>
        <p className="text-sm text-muted mt-1">Kein Artikel liegt am oder unter dem Mindestbestand.</p>
      </div>
    );
  }

  const toOrder = items.filter((i) => !i.is_ordered);
  const ordered = items.filter((i) => i.is_ordered);

  const renderItem = (item) => {
    const deficit = formatNumber(Number(item.min_stock_level) - Number(item.current_stock));
    return (
      <li key={item.id} className="rounded-2xl bg-surface shadow-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{item.name}</h3>
            <p className="text-sm text-muted mt-0.5 tnum">
              {formatQty(item.current_stock)} / Min. {formatQty(item.min_stock_level)} {item.unit}
              {Number(deficit) > 0 && !item.is_ordered && (
                <span className="text-critical font-medium"> · fehlt {deficit} {item.unit}</span>
              )}
            </p>
          </div>
          {isAdmin && (
            item.is_ordered ? (
              <button
                onClick={() => setOrdered(item, false)}
                disabled={busyId === item.id}
                className="shrink-0 min-h-[40px] rounded-lg border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 pressable transition-colors disabled:opacity-50"
              >
                Zurücksetzen
              </button>
            ) : (
              <button
                onClick={() => setOrdered(item, true)}
                disabled={busyId === item.id}
                className="shrink-0 min-h-[40px] rounded-lg bg-crust px-3 text-sm font-semibold text-white hover:bg-crust-dark pressable transition-colors disabled:opacity-50"
              >
                Bestellt ✓
              </button>
            )
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {toOrder.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
            Zu bestellen ({toOrder.length})
          </h2>
          <ul className="mt-2 space-y-2">{toOrder.map(renderItem)}</ul>
        </section>
      )}

      {ordered.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
            Bestellt — wartet auf Lieferung ({ordered.length})
          </h2>
          <ul className="mt-2 space-y-2">{ordered.map(renderItem)}</ul>
          <p className="mt-2 text-xs text-muted">
            Die Markierung wird beim Wareneingang automatisch zurückgesetzt.
          </p>
        </section>
      )}
    </div>
  );
}
