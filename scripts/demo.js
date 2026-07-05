/**
 * demo.js
 * Layer: script — local demo runner (development only, never production).
 * Boots the real server against pg-mem (in-memory PostgreSQL), applies all
 * migrations in order, and seeds realistic Austrian bakery/cafe data:
 * 12 fridges, items spread across them, and sample ledger movements.
 *
 * Note: all src imports are dynamic and happen only after the environment is
 * set, because static ESM imports are hoisted and would load env.js first.
 */

import { newDb } from 'pg-mem';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// 1) Demo environment, set before any module that reads env.
process.env.NODE_ENV = 'development';
process.env.PORT = '3000';
process.env.DATABASE_URL = 'postgres://demo:demo@localhost/demo';
process.env.SUPABASE_JWT_SECRET = 'super-secret-jwt-key-for-demo-mode-12345678';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.DEMO_MODE = 'true';

console.log('[demo] YAZOON demo mode (pg-mem) starting...');

// 2) In-memory database. gen_random_uuid must be registered as impure,
//    otherwise pg-mem caches the result and every row gets the same uuid,
//    which collides on the transactions primary key.
const db = newDb();
db.public.registerFunction({
  name: 'gen_random_uuid',
  returns: 'uuid',
  impure: true,
  implementation: () => crypto.randomUUID(),
});

// 3) Inject the pg-mem pool into db.js (dynamic import, after env setup).
const MockPool = db.adapters.createPg().Pool;
const pool = new MockPool();
const { setPool } = await import('../src/config/db.js');
setPool(pool);

// 4) Apply every migration in numeric order (CREATE EXTENSION is stripped
//    because pg-mem does not support it).
const migrationsDir = path.join(process.cwd(), 'migrations');
for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    .replace(/CREATE EXTENSION[^;]*;/gi, '');
  db.public.none(sql);
  console.log(`[demo] migration applied: ${file}`);
}

// 5) Seed: two users, four categories, twelve fridges, items, and movements.
const adminId = '11111111-1111-1111-1111-111111111111';
const staffId = '22222222-2222-2222-2222-222222222222';

const cats = {
  brot: crypto.randomUUID(),
  kaese: crypto.randomUUID(),
  belag: crypto.randomUUID(),
  saucen: crypto.randomUUID(),
};

// Twelve fridges in fixed display order.
const fridges = Array.from({ length: 12 }, (_, i) => ({
  id: crypto.randomUUID(),
  name: `Kühlschrank ${i + 1}`,
  position: i + 1,
}));
const K = (n) => fridges[n - 1].id;

// Items: [name, unit, stock, min, categoryId, locationId|null, isOrdered].
// The same product in two fridges is two independent rows, each with its own
// balance and threshold — e.g. Gouda in K1 and K7.
const items = [
  // Brot & Gebaeck — shelf storage (no fridge)
  ['Kaisersemmel', 'Stück', 48, 20, cats.brot, null, false],
  ['Kornspitz', 'Stück', 12, 20, cats.brot, null, false],
  ['Mohnflesserl', 'Stück', 18, 10, cats.brot, null, false],
  ['Brezel', 'Stück', 6, 15, cats.brot, null, true],
  // Kaese
  ['Gouda', 'kg', 4.5, 2, cats.kaese, K(1), false],
  ['Gouda', 'kg', 1.5, 1, cats.kaese, K(7), false],
  ['Emmentaler', 'kg', 1.2, 1.5, cats.kaese, K(1), false],
  ['Bergkäse', 'kg', 2.8, 1, cats.kaese, K(1), false],
  ['Frischkäse', 'kg', 0.8, 1, cats.kaese, K(2), false],
  // Belag & Zutaten
  ['Schinken', 'kg', 2.5, 1, cats.belag, K(3), false],
  ['Butter', 'kg', 6, 2, cats.belag, K(2), false],
  ['Tomaten', 'kg', 3, 2, cats.belag, K(4), false],
  ['Gurkerl', 'Glas', 4, 2, cats.belag, K(4), false],
  ['Eier', 'Stück', 30, 12, cats.belag, K(5), false],
  // Saucen & Aufstriche
  ['Mayonnaise', 'kg', 1.8, 1, cats.saucen, K(6), false],
  ['Senf', 'kg', 0.4, 0.5, cats.saucen, K(6), false],
  ['Liptauer', 'kg', 1.1, 0.5, cats.saucen, K(2), false],
].map((row) => ({ id: crypto.randomUUID(), row }));

const esc = (v) => (v === null ? 'NULL' : typeof v === 'string' ? `'${v}'` : v);

db.public.none(`
  INSERT INTO users (id, name, email, role) VALUES
  ('${adminId}', 'Admin User', 'admin@demo.com', 'admin'),
  ('${staffId}', 'Staff User', 'staff@demo.com', 'staff');

  INSERT INTO categories (id, name) VALUES
  ('${cats.brot}',  'Brot & Gebäck'),
  ('${cats.kaese}', 'Käse'),
  ('${cats.belag}', 'Belag & Zutaten'),
  ('${cats.saucen}','Saucen & Aufstriche');

  INSERT INTO locations (id, name, position) VALUES
  ${fridges.map((f) => `('${f.id}', '${f.name}', ${f.position})`).join(',\n  ')};

  INSERT INTO items (id, name, unit, current_stock, min_stock_level, category_id, location_id, is_ordered) VALUES
  ${items
    .map(({ id, row: [name, unit, stock, min, cat, loc, ordered] }) =>
      `('${id}', '${name}', '${unit}', ${stock}, ${min}, '${cat}', ${esc(loc)}, ${ordered})`)
    .join(',\n  ')};
`);

// Sample movements for the history view: inflow, outflow, waste, adjustment.
const byName = (n, loc) =>
  items.find(({ row }) => row[0] === n && (loc === undefined || row[5] === loc)).id;
const seedTx = [
  // [itemId, userId, type, qty, note]
  [byName('Gouda', K(1)), adminId, 'in', 2, 'Lieferung Montag'],
  [byName('Kaisersemmel'), staffId, 'in', 30, 'Morgenlieferung'],
  [byName('Schinken'), staffId, 'out', -0.5, null],
  [byName('Frischkäse'), staffId, 'waste', -0.4, 'verdorben — MHD überschritten'],
  [byName('Brezel'), staffId, 'waste', -4, 'vom Vortag, nicht verkauft'],
  [byName('Senf'), adminId, 'adjustment', -0.1, 'Inventur-Differenz'],
];

db.public.none(`
  INSERT INTO transactions (item_id, user_id, type, quantity_change, note) VALUES
  ${seedTx
    .map(([item, user, type, qty, note]) => `('${item}', '${user}', '${type}', ${qty}, ${esc(note)})`)
    .join(',\n  ')};
`);

console.log('[demo] seed complete: 2 users, 4 categories, 12 fridges, 17 items, 6 movements');
console.log('[demo] login: admin@demo.com / staff@demo.com — password: demo');

// 6) Start the server (dynamic import, everything is ready).
await import('../src/server.js');
