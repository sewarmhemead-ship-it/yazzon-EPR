/**
 * ItemSheet.jsx — ورقة تفاصيل العنصر (سفلية على الموبايل، مركزية على الشاشات الكبيرة).
 * تعرض الرصيد كبيراً + المقياس بخط الحد + كل العمليات:
 * إدخال/سحب (للجميع)، Korrektur وتعليم "بستلت" وتعديل الحد الأدنى (للمدير).
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import {
  formatQty, stockStatus, STATUS_LABEL, STATUS_BADGE,
  normalizeDecimalInput, POSITIVE_DECIMAL,
} from '../lib/format.js';
import StockMeter from './StockMeter.jsx';
import QuantityDialog from './QuantityDialog.jsx';

export default function ItemSheet({ item, onClose, onChanged, notify }) {
  const { isAdmin } = useAuth();
  const [dialog, setDialog] = useState(null); // 'receive' | 'consume' | 'adjust'
  const [editingMin, setEditingMin] = useState(false);
  const [minValue, setMinValue] = useState(item.min_stock_level);
  const [editingLoc, setEditingLoc] = useState(false);
  const [locations, setLocations] = useState([]);
  const [busy, setBusy] = useState(false);
  const status = stockStatus(item);

  // تحميل الأقسام عند فتح محرّر الموقع فقط.
  useEffect(() => {
    if (editingLoc && locations.length === 0) {
      api.listLocations().then(({ locations }) => setLocations(locations)).catch(() => {});
    }
  }, [editingLoc, locations.length]);

  async function moveTo(locationId) {
    setBusy(true);
    try {
      await api.updateItem(item.id, { locationId });
      setEditingLoc(false);
      onChanged(null, item.name);
      notify(`Ort geändert: ${item.name}`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !dialog) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, dialog]);

  async function submitDialog({ quantity, type, delta, note }) {
    let result;
    if (dialog === 'receive') result = await api.receive(item.id, quantity, note);
    else if (dialog === 'consume') result = await api.consume(item.id, quantity, type, note);
    else result = await api.adjust(item.id, delta, note);
    setDialog(null);
    onChanged(result.transaction, item.name);
    notify(
      dialog === 'receive' ? `Wareneingang gebucht: ${item.name}`
        : dialog === 'consume' ? `Entnahme gebucht: ${item.name}`
        : `Korrektur gebucht: ${item.name}`,
      'success',
    );
  }

  async function toggleOrdered() {
    setBusy(true);
    try {
      if (item.is_ordered) await api.unmarkOrdered(item.id);
      else await api.markOrdered(item.id);
      onChanged(null, item.name);
      notify(item.is_ordered ? `Bestell-Markierung entfernt: ${item.name}` : `Als bestellt markiert: ${item.name}`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveMin() {
    const v = normalizeDecimalInput(minValue);
    if (!POSITIVE_DECIMAL.test(v) || Number(v) <= 0) {
      notify('Mindestbestand muss größer als 0 sein.', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.updateItem(item.id, { minStockLevel: v });
      setEditingMin(false);
      onChanged(null, item.name);
      notify(`Mindestbestand geändert: ${item.name}`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const actionCls =
    'min-h-[44px] rounded-lg border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 pressable transition-colors disabled:opacity-50';

  return (
    <>
      <div
        className="fixed inset-0 z-30 grid place-items-end sm:place-items-center bg-ink/35 anim-fade"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Artikel · ${item.name}`}
      >
        <div
          className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-float anim-sheet"
          onClick={(e) => e.stopPropagation()}
        >
          {/* الترويسة: اسم + تصنيف + حالة */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{item.name}</h2>
              <p className="text-xs text-muted mt-0.5">
                📍 {item.location_name ?? 'Regal'}
                {item.category_name && ` · ${item.category_name}`}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[status]}`}>
              {STATUS_LABEL[status]}
            </span>
          </div>

          {/* الرصيد — البؤرة البصرية */}
          <div className="mt-5">
            <p className="tnum text-4xl font-bold tracking-tight">
              {formatQty(item.current_stock)}
              <span className="text-lg font-medium text-muted ml-1.5">{item.unit}</span>
            </p>
            <div className="mt-3">
              <StockMeter item={item} tall />
              <div className="mt-1.5 flex justify-between text-xs text-muted">
                <span>0</span>
                <span className="tnum">Mindestbestand: {formatQty(item.min_stock_level)} {item.unit}</span>
              </div>
            </div>
          </div>

          {/* العمليات اليومية */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              onClick={() => setDialog('consume')}
              className="min-h-[48px] rounded-xl border border-line font-semibold text-ink hover:bg-surface-2 pressable transition-colors"
            >
              − Entnahme
            </button>
            <button
              onClick={() => setDialog('receive')}
              className="min-h-[48px] rounded-xl bg-crust font-semibold text-white hover:bg-crust-dark pressable transition-colors"
            >
              + Eingang
            </button>
          </div>

          {/* أدوات المدير */}
          {isAdmin && (
            <div className="mt-4 border-t border-line-soft pt-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setDialog('adjust')} className={actionCls}>
                  Korrektur
                </button>
                <button onClick={toggleOrdered} disabled={busy} className={actionCls}>
                  {item.is_ordered ? 'Bestellung zurücksetzen' : 'Als bestellt markieren'}
                </button>
                <button onClick={() => setEditingMin((v) => !v)} className={actionCls}>
                  Mindestbestand ändern
                </button>
                <button onClick={() => setEditingLoc((v) => !v)} className={actionCls}>
                  Ort ändern
                </button>
              </div>
              {editingLoc && (
                <select
                  defaultValue={item.location_id ?? ''}
                  onChange={(e) => e.target.value && moveTo(e.target.value)}
                  disabled={busy}
                  className="w-full min-h-[44px] rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-crust"
                  aria-label="Neuen Ort wählen"
                >
                  <option value="" disabled>Kühlschrank wählen …</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}
              {editingMin && (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={minValue}
                    onChange={(e) => setMinValue(e.target.value)}
                    className="tnum flex-1 min-h-[44px] rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-crust"
                    aria-label="Neuer Mindestbestand"
                  />
                  <button onClick={saveMin} disabled={busy} className="min-h-[44px] rounded-lg bg-crust px-4 font-semibold text-white hover:bg-crust-dark pressable disabled:opacity-50">
                    Speichern
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-4 w-full min-h-[44px] rounded-lg text-sm font-medium text-muted hover:text-ink transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>

      {dialog && (
        <QuantityDialog item={item} mode={dialog} onSubmit={submitDialog} onClose={() => setDialog(null)} />
      )}
    </>
  );
}
