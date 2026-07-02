/**
 * HistoryView.jsx — شاشة Verlauf: سجل كل الحركات (جاي/رايح/فاسد/تصحيح) من السجل
 * الثابت [INV-3]، الأحدث أولاً، مع فلاتر نوع وبراد. كل صف: النوع، الغرض، الكمية ±،
 * البراد، المستخدم، والوقت بتوقيت فيينا [INV-5].
 */

import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { TX_LABEL, TX_BADGE, formatDateTime, formatNumber } from '../lib/format.js';

const TYPE_FILTERS = [
  { key: '', label: 'Alle' },
  { key: 'in', label: 'Eingang' },
  { key: 'out', label: 'Entnahme' },
  { key: 'waste', label: 'Verlust' },
  { key: 'adjustment', label: 'Korrektur' },
];

export default function HistoryView() {
  const [transactions, setTransactions] = useState(null);
  const [locations, setLocations] = useState([]);
  const [type, setType] = useState('');
  const [locationId, setLocationId] = useState('');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setTransactions(null);
    try {
      const [{ transactions }, { locations }] = await Promise.all([
        api.listTransactions({ type, locationId, limit: 60 }),
        api.listLocations(),
      ]);
      setTransactions(transactions);
      setLocations(locations);
      setError(null);
    } catch (err) {
      setError(err.message);
      setTransactions([]);
    }
  }, [type, locationId]);

  useEffect(() => {
    load();
  }, [load]);

  const chipCls = (active) =>
    `shrink-0 rounded-full px-3.5 min-h-[36px] text-sm font-medium border pressable transition-colors ${
      active ? 'border-crust bg-crust-soft text-crust-dark' : 'border-line text-ink-2 hover:bg-surface'
    }`;

  return (
    <div>
      {/* فلاتر النوع */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Bewegungsart">
        {TYPE_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setType(f.key)} className={chipCls(type === f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* فلتر البراد */}
      <select
        value={locationId}
        onChange={(e) => setLocationId(e.target.value)}
        className="mt-2 w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 outline-none focus:border-crust"
        aria-label="Kühlschrank filtern"
      >
        <option value="">Alle Orte</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>

      {error && <p className="mt-3 text-critical">{error}</p>}

      {transactions === null ? (
        <div className="mt-3 space-y-2" aria-busy="true">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-surface shadow-card animate-pulse" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-surface shadow-card p-8 text-center">
          <p className="font-semibold">Keine Bewegungen gefunden.</p>
          <p className="text-sm text-muted mt-1">Filter anpassen oder erste Buchung erfassen.</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {transactions.map((tx) => {
            const qty = Number(tx.quantity_change);
            return (
              <li key={tx.id} className="rounded-xl bg-surface shadow-card px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TX_BADGE[tx.type]}`}>
                      {TX_LABEL[tx.type]}
                    </span>
                    <span className="truncate font-semibold">{tx.item_name}</span>
                  </div>
                  <span className={`shrink-0 tnum font-bold ${qty < 0 ? (tx.type === 'waste' ? 'text-critical' : 'text-ink-2') : 'text-ok'}`}>
                    {qty > 0 ? '+' : ''}{formatNumber(tx.quantity_change)} {tx.unit}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {tx.location_name ?? 'Regal'} · {tx.user_name} · {formatDateTime(tx.created_at)}
                  {tx.reverses_transaction_id && ' · ↩ Storno'}
                </p>
                {tx.note && <p className="mt-0.5 text-xs text-ink-2 italic">&quot;{tx.note}&quot;</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
