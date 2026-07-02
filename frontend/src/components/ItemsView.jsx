/**
 * ItemsView.jsx — شاشة Bestand: بحث + فلاتر حالة + شرائح تصنيفات + بطاقات "علامة الرفّ".
 * النقر على البطاقة يفتح ورقة التفاصيل (ItemSheet)؛ وزرّا ‎−/+‎ السريعان يبقيان على البطاقة
 * (سير العمل اليومي الأسرع). آخر حركة تُحفظ في localStorage ليصمد Rückgängig بعد التحديث.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import {
  formatQty, stockStatus, STATUS_LABEL, STATUS_BADGE, STATUS_RANK,
} from '../lib/format.js';
import StockMeter from './StockMeter.jsx';
import QuantityDialog from './QuantityDialog.jsx';
import ItemSheet from './ItemSheet.jsx';
import NewItemForm from './NewItemForm.jsx';

const LAST_TX_KEY = 'lager.lastTx';

const STATUS_FILTERS = [
  { key: 'all', label: 'Alle' },
  { key: 'critical', label: 'Kritisch' },
  { key: 'low', label: 'Niedrig' },
  { key: 'ordered', label: 'Bestellt' },
];

function readLastTx() {
  try {
    return JSON.parse(localStorage.getItem(LAST_TX_KEY)) ?? null;
  } catch {
    return null;
  }
}

export default function ItemsView({ notify }) {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState(null); // null = تحميل
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [quickDialog, setQuickDialog] = useState(null); // { item, mode }
  const [sheetItem, setSheetItem] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [lastTx, setLastTx] = useState(readLastTx);

  const load = useCallback(async () => {
    try {
      const [{ items }, { categories }] = await Promise.all([
        api.listItems(),
        api.listCategories(),
      ]);
      setItems(items);
      setCategories(categories);
      setError(null);
    } catch (err) {
      setError(err.message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function rememberTx(tx, itemName) {
    if (!tx) return;
    const entry = { id: tx.id, itemName };
    setLastTx(entry);
    localStorage.setItem(LAST_TX_KEY, JSON.stringify(entry));
  }

  function clearTx() {
    setLastTx(null);
    localStorage.removeItem(LAST_TX_KEY);
  }

  async function onChanged(tx, itemName) {
    rememberTx(tx, itemName);
    await load();
    // حدّث نسخة الورقة المفتوحة بالبيانات الجديدة
    setSheetItem((prev) => prev ? null : prev);
  }

  async function submitQuick({ quantity, type, note }) {
    const { item, mode } = quickDialog;
    const result = mode === 'receive'
      ? await api.receive(item.id, quantity, note)
      : await api.consume(item.id, quantity, type, note);
    setQuickDialog(null);
    rememberTx(result.transaction, item.name);
    await load();
    notify(mode === 'receive' ? `Wareneingang gebucht: ${item.name}` : `Entnahme gebucht: ${item.name}`, 'success');
  }

  async function handleUndo() {
    try {
      await api.undo(lastTx.id);
      const name = lastTx.itemName;
      clearTx();
      await load();
      notify(`Letzte Buchung rückgängig gemacht: ${name}`, 'success');
    } catch (err) {
      // حركة مُراجَعة سابقاً أو رصيد لا يسمح — امسح التذكّر وبيّن السبب.
      clearTx();
      notify(err.message, 'error');
    }
  }

  const visible = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items
      .filter((it) => (q ? it.name.toLowerCase().includes(q) : true))
      .filter((it) => (statusFilter === 'all' ? true : stockStatus(it) === statusFilter))
      .filter((it) => (categoryFilter === 'all' ? true : it.category_id === categoryFilter))
      .sort((a, b) =>
        STATUS_RANK[stockStatus(a)] - STATUS_RANK[stockStatus(b)] || a.name.localeCompare(b.name, 'de'),
      );
  }, [items, search, statusFilter, categoryFilter]);

  const chipCls = (active) =>
    `shrink-0 rounded-full px-3.5 min-h-[36px] text-sm font-medium border pressable transition-colors ${
      active ? 'border-crust bg-crust-soft text-crust-dark' : 'border-line text-ink-2 hover:bg-surface'
    }`;

  if (items === null) {
    // Skeleton — هيكل تحميل بدل نص جاف
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Wird geladen">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface shadow-card p-4 animate-pulse">
            <div className="h-4 w-1/3 rounded bg-line-soft" />
            <div className="mt-3 h-2 w-full rounded bg-line-soft" />
            <div className="mt-3 h-9 w-2/3 rounded bg-line-soft" />
          </div>
        ))}
      </div>
    );
  }
  if (error) return <p className="text-critical p-2">{error}</p>;

  return (
    <div>
      {/* بحث + إنشاء (مدير) */}
      <div className="flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Artikel suchen …"
          aria-label="Artikel suchen"
          className="flex-1 min-h-[44px] rounded-xl border border-line bg-surface px-4 outline-none focus:border-crust"
        />
        {isAdmin && (
          <button
            onClick={() => setShowNewForm(true)}
            className="shrink-0 min-h-[44px] rounded-xl bg-crust px-4 font-semibold text-white hover:bg-crust-dark pressable transition-colors"
            aria-label="Neuen Artikel anlegen"
          >
            + Artikel
          </button>
        )}
      </div>

      {/* فلاتر الحالة */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Statusfilter">
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)} className={chipCls(statusFilter === f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* شرائح التصنيفات */}
      {categories.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Kategorien">
          <button onClick={() => setCategoryFilter('all')} className={chipCls(categoryFilter === 'all')}>
            Alle Kategorien
          </button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCategoryFilter(c.id)} className={chipCls(categoryFilter === c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* شريط التراجع */}
      {lastTx && isAdmin && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-surface shadow-card px-4 py-2.5">
          <span className="text-sm text-muted truncate">Letzte Buchung: {lastTx.itemName}</span>
          <button onClick={handleUndo} className="shrink-0 min-h-[36px] text-sm font-semibold text-crust hover:text-crust-dark px-2">
            Rückgängig
          </button>
        </div>
      )}

      {/* القائمة */}
      {visible.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-surface shadow-card p-8 text-center">
          <p className="font-semibold">Keine Artikel gefunden.</p>
          <p className="text-sm text-muted mt-1">
            {items.length === 0 ? 'Lege den ersten Artikel unter „Neu“ an.' : 'Suche oder Filter anpassen.'}
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {visible.map((item) => {
            const status = stockStatus(item);
            return (
              <li key={item.id} className="rounded-2xl bg-surface shadow-card p-4">
                {/* الجزء القابل للنقر: يفتح التفاصيل */}
                <button
                  onClick={() => setSheetItem(item)}
                  className="w-full text-left"
                  aria-label={`Details ${item.name}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{item.name}</h3>
                      <p className="text-sm mt-0.5">
                        <span className="tnum font-semibold text-ink">{formatQty(item.current_stock)}</span>
                        <span className="text-muted"> {item.unit} · Min. {formatQty(item.min_stock_level)}</span>
                      </p>
                      <p className="text-xs text-faint mt-0.5 truncate">
                        {item.location_name ?? 'Regal'}
                        {item.category_name && ` · ${item.category_name}`}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <StockMeter item={item} />
                  </div>
                </button>

                {/* عمليات سريعة */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setQuickDialog({ item, mode: 'consume' })}
                    className="flex-1 min-h-[44px] rounded-lg border border-line font-semibold text-ink-2 hover:bg-surface-2 pressable transition-colors"
                    aria-label={`Entnahme ${item.name}`}
                  >
                    −
                  </button>
                  <button
                    onClick={() => setQuickDialog({ item, mode: 'receive' })}
                    className="flex-1 min-h-[44px] rounded-lg bg-crust font-semibold text-white hover:bg-crust-dark pressable transition-colors"
                    aria-label={`Wareneingang ${item.name}`}
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {quickDialog && (
        <QuantityDialog
          item={quickDialog.item}
          mode={quickDialog.mode}
          onSubmit={submitQuick}
          onClose={() => setQuickDialog(null)}
        />
      )}

      {sheetItem && (
        <ItemSheet
          item={items.find((i) => i.id === sheetItem.id) ?? sheetItem}
          onClose={() => setSheetItem(null)}
          onChanged={onChanged}
          notify={notify}
        />
      )}

      {/* ورقة إنشاء عنصر (مدير) */}
      {showNewForm && (
        <div
          className="fixed inset-0 z-30 grid place-items-end sm:place-items-center bg-ink/35 anim-fade overflow-y-auto"
          onClick={() => setShowNewForm(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Neuer Artikel"
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-float anim-sheet max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Neuer Artikel</h2>
              <button onClick={() => setShowNewForm(false)} className="min-h-[36px] text-sm font-medium text-muted hover:text-ink px-2">
                Schließen
              </button>
            </div>
            <div className="mt-4">
              <NewItemForm
                notify={notify}
                onCreated={async () => { setShowNewForm(false); await load(); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
