/**
 * NewItemForm.jsx — إنشاء عنصر جديد (للمدير): اسم + وحدة + تصنيف + براد (Kühlschrank) + حد أدنى.
 * الرصيد يبدأ صفراً [INV-3]؛ الوحدة إلزامية [INV-6]؛ يقبل الفاصلة الألمانية.
 * يُستخدم داخل ورقة من Bestand (onCreated يُغلقها ويحدّث القائمة).
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { normalizeDecimalInput, POSITIVE_DECIMAL } from '../lib/format.js';

/** وحدات شائعة في مطبخ/مخبز — اختيار بلمسة بدل الكتابة. */
const COMMON_UNITS = ['Stück', 'kg', 'g', 'L', 'Scheiben', 'Packung', 'Glas'];

export default function NewItemForm({ notify, onCreated }) {
  const { isAdmin } = useAuth();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    api.listCategories().then(({ categories }) => setCategories(categories)).catch(() => {});
    api.listLocations().then(({ locations }) => setLocations(locations)).catch(() => {});
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="rounded-2xl bg-surface shadow-card p-8 text-center">
        <p className="font-semibold">Nur für Administratoren</p>
        <p className="text-sm text-muted mt-1">Das Anlegen von Artikeln ist Administratoren vorbehalten.</p>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !unit.trim()) {
      setError('Name und Einheit sind erforderlich.');
      return;
    }
    const min = normalizeDecimalInput(minStockLevel);
    if (!POSITIVE_DECIMAL.test(min) || Number(min) <= 0) {
      setError('Mindestbestand muss eine Zahl größer als 0 sein (z. B. 2,5).');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let catId = categoryId || null;
      if (newCatMode && newCatName.trim()) {
        const { category } = await api.createCategory(newCatName.trim());
        catId = category.id;
      }
      const { item } = await api.createItem({
        name: name.trim(),
        unit: unit.trim(),
        minStockLevel: min,
        categoryId: catId,
        locationId: locationId || null,
      });
      notify(`Artikel angelegt: ${item.name}`, 'success');
      setName('');
      setUnit('');
      setMinStockLevel('1');
      setNewCatMode(false);
      setNewCatName('');
      setLocationId('');
      onCreated?.(item);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    'mt-1 w-full min-h-[44px] rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-crust';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          placeholder="z. B. Kornspitz, Gouda, Schinken"
        />
      </label>

      <div>
        <span className="text-sm font-medium">Einheit (Grundeinheit)</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {COMMON_UNITS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`min-h-[36px] rounded-full border px-3 text-sm font-medium pressable transition-colors ${
                unit === u ? 'border-crust bg-crust-soft text-crust-dark' : 'border-line text-ink-2 hover:bg-surface-2'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className={inputCls}
          placeholder="oder eigene Einheit …"
          aria-label="Einheit"
        />
      </div>

      <label className="block">
        <span className="text-sm font-medium">Kühlschrank / Lagerort</span>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="mt-1 w-full min-h-[44px] rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-crust"
        >
          <option value="">— Regal / ohne Kühlschrank —</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>

      <div>
        <span className="text-sm font-medium">Kategorie</span>
        {!newCatMode ? (
          <div className="mt-1 flex gap-2">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex-1 min-h-[44px] rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-crust"
              aria-label="Kategorie wählen"
            >
              <option value="">— Keine —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNewCatMode(true)}
              className="min-h-[44px] rounded-lg border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 pressable"
            >
              + Neu
            </button>
          </div>
        ) : (
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1 min-h-[44px] rounded-lg border border-line bg-surface-2 px-3 outline-none focus:border-crust"
              placeholder="Neue Kategorie …"
              autoFocus
            />
            <button
              type="button"
              onClick={() => { setNewCatMode(false); setNewCatName(''); }}
              className="min-h-[44px] rounded-lg border border-line px-3 text-sm font-medium text-muted hover:bg-surface-2 pressable"
            >
              Abbrechen
            </button>
          </div>
        )}
      </div>

      <label className="block">
        <span className="text-sm font-medium">Mindestbestand (Warnschwelle)</span>
        <input
          type="text"
          inputMode="decimal"
          value={minStockLevel}
          onChange={(e) => setMinStockLevel(e.target.value)}
          className={`${inputCls} tnum`}
        />
        <span className="text-xs text-muted mt-1 block">
          Der Bestand startet bei 0 — Zugänge über „+ Eingang" buchen.
        </span>
      </label>

      {error && <p className="text-sm text-critical">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full min-h-[48px] rounded-xl bg-crust px-4 font-semibold text-white hover:bg-crust-dark disabled:opacity-50 pressable transition-colors"
      >
        {busy ? 'Wird angelegt …' : 'Artikel anlegen'}
      </button>
    </form>
  );
}
