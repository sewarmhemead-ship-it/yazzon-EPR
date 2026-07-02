/**
 * FridgesView.jsx — شاشة Kühlschränke: شبكة الـ 12 براداً، كل بطاقة تُظهر عدد الأغراض
 * وعدد الحرج فيها. اختيار براد → محتوياته (بطاقات مصغّرة، نقرة تفتح ItemSheet)
 * + آخر حركاته (جاي/رايح/فاسد) عبر GET /transactions?locationId.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../lib/api.js';
import {
  formatQty, stockStatus, STATUS_BADGE, STATUS_LABEL, STATUS_RANK,
  TX_LABEL, TX_BADGE, formatDateTime, formatNumber,
} from '../lib/format.js';
import StockMeter from './StockMeter.jsx';
import ItemSheet from './ItemSheet.jsx';

export default function FridgesView({ notify }) {
  const [locations, setLocations] = useState(null);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null); // location object
  const [movements, setMovements] = useState(null);
  const [sheetItem, setSheetItem] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [{ locations }, { items }] = await Promise.all([
        api.listLocations(),
        api.listItems(),
      ]);
      setLocations(locations);
      setItems(items);
      setError(null);
    } catch (err) {
      setError(err.message);
      setLocations([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // حركات البراد المحدّد.
  useEffect(() => {
    if (!selected) return;
    setMovements(null);
    api.listTransactions({ locationId: selected.id, limit: 15 })
      .then(({ transactions }) => setMovements(transactions))
      .catch(() => setMovements([]));
  }, [selected, items]); // items يتغيّر بعد كل حركة → يعيد جلب السجل

  const byLocation = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!it.location_id) continue;
      if (!map.has(it.location_id)) map.set(it.location_id, []);
      map.get(it.location_id).push(it);
    }
    return map;
  }, [items]);

  async function onChanged() {
    await load();
  }

  if (locations === null) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-busy="true">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface shadow-card animate-pulse" />
        ))}
      </div>
    );
  }
  if (error) return <p className="text-critical p-2">{error}</p>;

  /* ------- عرض براد واحد ------- */
  if (selected) {
    const content = (byLocation.get(selected.id) ?? [])
      .sort((a, b) => STATUS_RANK[stockStatus(a)] - STATUS_RANK[stockStatus(b)] || a.name.localeCompare(b.name, 'de'));

    return (
      <div>
        <button onClick={() => setSelected(null)} className="min-h-[40px] text-sm font-semibold text-crust hover:text-crust-dark">
          ← Alle Kühlschränke
        </button>
        <h2 className="text-2xl font-bold mt-1">{selected.name}</h2>
        <p className="text-sm text-muted">{content.length} Artikel</p>

        {/* المحتويات */}
        {content.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-surface shadow-card p-6 text-center">
            <p className="font-semibold">Leer.</p>
            <p className="text-sm text-muted mt-1">Diesem Kühlschrank sind keine Artikel zugeordnet.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {content.map((item) => {
              const status = stockStatus(item);
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setSheetItem(item)}
                    className="w-full text-left rounded-xl bg-surface shadow-card p-3.5 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{item.name}</p>
                        <p className="text-sm tnum">
                          <span className="font-semibold">{formatQty(item.current_stock)}</span>
                          <span className="text-muted"> {item.unit} · Min. {formatQty(item.min_stock_level)}</span>
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </div>
                    <div className="mt-2"><StockMeter item={item} /></div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* آخر الحركات في هذا البراد */}
        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-muted">Letzte Bewegungen</h3>
        {movements === null ? (
          <div className="mt-2 h-16 rounded-xl bg-surface shadow-card animate-pulse" />
        ) : movements.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Noch keine Bewegungen.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {movements.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface shadow-card px-3.5 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TX_BADGE[tx.type]}`}>
                    {TX_LABEL[tx.type]}
                  </span>
                  <span className="truncate text-sm font-medium">{tx.item_name}</span>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`tnum text-sm font-bold ${Number(tx.quantity_change) < 0 ? 'text-ink-2' : 'text-ok'}`}>
                    {Number(tx.quantity_change) > 0 ? '+' : ''}{formatNumber(tx.quantity_change)} {tx.unit}
                  </p>
                  <p className="text-[11px] text-faint">{formatDateTime(tx.created_at)} · {tx.user_name}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {sheetItem && (
          <ItemSheet
            item={items.find((i) => i.id === sheetItem.id) ?? sheetItem}
            onClose={() => setSheetItem(null)}
            onChanged={onChanged}
            notify={notify}
          />
        )}
      </div>
    );
  }

  /* ------- شبكة البرادات ------- */
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {locations.map((loc) => {
          const content = byLocation.get(loc.id) ?? [];
          const critical = content.filter((i) => stockStatus(i) === 'critical').length;
          return (
            <button
              key={loc.id}
              onClick={() => setSelected(loc)}
              className="relative text-left rounded-2xl bg-surface shadow-card p-4 min-h-[96px] hover:bg-surface-2 pressable transition-colors"
            >
              {critical > 0 && (
                <span className="absolute top-3 right-3 grid place-items-center min-w-[22px] h-[22px] rounded-full bg-critical text-white text-[11px] font-bold px-1.5">
                  {critical}
                </span>
              )}
              <p className="font-bold leading-tight pr-6">{loc.name}</p>
              <p className="tnum text-sm text-muted mt-1.5">
                {content.length} Artikel
              </p>
              {content.length === 0 && <p className="text-xs text-faint mt-0.5">leer</p>}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">
        Artikel ohne Kühlschrank (z. B. Brot im Regal) findest du im Bestand.
      </p>
    </div>
  );
}
