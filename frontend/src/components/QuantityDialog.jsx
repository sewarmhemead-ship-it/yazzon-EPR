/**
 * QuantityDialog.jsx — quantity dialog for three operations: receive (goods
 * in), consume (withdrawal/waste), and adjust (inventory correction, admin,
 * with a +/- direction toggle).
 * Accepts the German decimal comma ("2,5") and normalizes it. Closes on
 * Escape and on backdrop click; the quantity field receives focus.
 */

import { useEffect, useState } from 'react';
import { normalizeDecimalInput, POSITIVE_DECIMAL, formatQty } from '../lib/format.js';

const TITLES = {
  receive: 'Wareneingang',
  consume: 'Entnahme',
  adjust: 'Korrektur (Inventur)',
};

export default function QuantityDialog({ item, mode, onSubmit, onClose }) {
  const [quantity, setQuantity] = useState('');
  const [type, setType] = useState('out'); // consume: out | waste
  const [sign, setSign] = useState('-');   // adjust: + | -
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Escape closes the dialog (baseline dialog accessibility).
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    const q = normalizeDecimalInput(quantity);
    if (!POSITIVE_DECIMAL.test(q) || Number(q) <= 0) {
      setError('Bitte eine gültige Menge größer als 0 eingeben (z. B. 2,5).');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        quantity: q,
        type,
        delta: sign === '-' ? `-${q}` : q,
        note: note.trim() || undefined,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const inputCls =
    'mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 outline-none focus:border-crust min-h-[44px]';

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-end sm:place-items-center bg-ink/35 anim-fade"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${TITLES[mode]} · ${item.name}`}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-float anim-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">{TITLES[mode]}</h2>
        <p className="text-sm text-muted mt-0.5">
          {item.name} · Bestand: <span className="tnum font-medium text-ink-2">{formatQty(item.current_stock)} {item.unit}</span>
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {mode === 'adjust' && (
            <div role="group" aria-label="Richtung" className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSign('-')}
                className={`min-h-[44px] rounded-lg border font-semibold pressable transition-colors ${
                  sign === '-' ? 'border-crust bg-crust-soft text-crust-dark' : 'border-line text-ink-2'
                }`}
              >
                Weniger als im System
              </button>
              <button
                type="button"
                onClick={() => setSign('+')}
                className={`min-h-[44px] rounded-lg border font-semibold pressable transition-colors ${
                  sign === '+' ? 'border-crust bg-crust-soft text-crust-dark' : 'border-line text-ink-2'
                }`}
              >
                Mehr als im System
              </button>
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium">Menge ({item.unit})</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={`${inputCls} tnum text-lg`}
              placeholder="z. B. 2,5"
            />
          </label>

          {mode === 'consume' && (
            <div role="group" aria-label="Art" className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('out')}
                className={`min-h-[44px] rounded-lg border font-semibold pressable transition-colors ${
                  type === 'out' ? 'border-crust bg-crust-soft text-crust-dark' : 'border-line text-ink-2'
                }`}
              >
                Verbrauch
              </button>
              <button
                type="button"
                onClick={() => setType('waste')}
                className={`min-h-[44px] rounded-lg border font-semibold pressable transition-colors ${
                  type === 'waste' ? 'border-critical bg-critical-soft text-critical' : 'border-line text-ink-2'
                }`}
              >
                Verlust / Verderb
              </button>
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium">Notiz {mode === 'adjust' ? '(Grund)' : '(optional)'}</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputCls}
              placeholder={mode === 'adjust' ? 'z. B. Inventur, Bruch, Schwund' : ''}
            />
          </label>

          {error && <p className="text-sm text-critical">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] rounded-lg border border-line px-4 font-medium text-ink-2 hover:bg-surface-2 pressable transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 min-h-[44px] rounded-lg bg-crust px-4 font-semibold text-white hover:bg-crust-dark disabled:opacity-50 pressable transition-colors"
            >
              {busy ? '…' : 'Buchen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
