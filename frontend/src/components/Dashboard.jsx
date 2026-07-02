/**
 * Dashboard.jsx — شاشة Übersicht: نظرة الصباح قبل الفتح.
 * البؤرة: "ما الذي يحتاج انتباهي الآن؟" — عدّادات الحالة ثم قائمة الأشدّ نقصاً.
 * تُحسب من /items مباشرة (استعلام لحظي — لا jobs، القسم 10).
 */

import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { formatQty, formatNumber, stockStatus } from '../lib/format.js';

export default function Dashboard({ goTo }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { items } = await api.listItems();
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

  if (items === null) {
    return (
      <div className="grid grid-cols-2 gap-3" aria-busy="true">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface shadow-card animate-pulse" />
        ))}
      </div>
    );
  }
  if (error) return <p className="text-critical p-2">{error}</p>;

  const byStatus = { critical: [], ordered: [], low: [], ok: [] };
  for (const it of items) byStatus[stockStatus(it)].push(it);

  const attention = [...byStatus.critical, ...byStatus.ordered]
    .sort((a, b) =>
      (Number(b.min_stock_level) - Number(b.current_stock)) -
      (Number(a.min_stock_level) - Number(a.current_stock)),
    )
    .slice(0, 5);

  const tiles = [
    { label: 'Artikel gesamt', value: items.length, tone: 'text-ink' },
    { label: 'Kritisch', value: byStatus.critical.length, tone: byStatus.critical.length ? 'text-critical' : 'text-ink' },
    { label: 'Niedrig', value: byStatus.low.length, tone: byStatus.low.length ? 'text-warn' : 'text-ink' },
    { label: 'Bestellt', value: byStatus.ordered.length, tone: 'text-ink' },
  ];

  return (
    <div>
      {/* عدّادات الحالة */}
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-surface shadow-card p-4">
            <p className={`tnum text-3xl font-bold tracking-tight ${t.tone}`}>{t.value}</p>
            <p className="text-xs font-medium text-muted mt-1 uppercase tracking-wide">{t.label}</p>
          </div>
        ))}
      </div>

      {/* يحتاج انتباهك */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">Braucht Aufmerksamkeit</h2>
          {attention.length > 0 && (
            <button onClick={() => goTo('alerts')} className="text-sm font-semibold text-crust hover:text-crust-dark min-h-[36px]">
              Alle Warnungen →
            </button>
          )}
        </div>

        {attention.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-surface shadow-card p-6 text-center">
            <p className="font-semibold text-ok">Alles aufgefüllt.</p>
            <p className="text-sm text-muted mt-1">Kein Artikel liegt am oder unter dem Mindestbestand.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {attention.map((it) => {
              const deficit = formatNumber(Number(it.min_stock_level) - Number(it.current_stock));
              return (
                <li key={it.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface shadow-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{it.name}</p>
                    <p className="text-sm text-muted tnum">
                      {formatQty(it.current_stock)} / Min. {formatQty(it.min_stock_level)} {it.unit}
                    </p>
                  </div>
                  {it.is_ordered ? (
                    <span className="shrink-0 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">Bestellt</span>
                  ) : (
                    <span className="shrink-0 tnum text-sm font-semibold text-critical">fehlt {deficit}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* اختصار للعمل اليومي */}
      <button
        onClick={() => goTo('items')}
        className="mt-5 w-full min-h-[48px] rounded-xl bg-crust font-semibold text-white hover:bg-crust-dark pressable transition-colors"
      >
        Zum Bestand
      </button>
    </div>
  );
}
