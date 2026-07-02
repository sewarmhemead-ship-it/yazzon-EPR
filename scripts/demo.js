/**
 * demo.js — تشغيل تجريبي محلي (للتطوير فقط، ليس للإنتاج).
 * pg-mem (PostgreSQL في الذاكرة) + كل migrations بالترتيب + بيانات مقهى نمساوي واقعية:
 * 12 براداً (Kühlschränke)، أغراض موزّعة عليها، وحركات عيّنة للسجل (Verlauf).
 * ملاحظة: استيرادات src ديناميكية *بعد* ضبط البيئة (ESM يرفع الـ import الثابت).
 */

import { newDb } from 'pg-mem';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// 1) بيئة العرض قبل تحميل أي وحدة تقرأ env.
process.env.NODE_ENV = 'development';
process.env.PORT = '3000';
process.env.DATABASE_URL = 'postgres://demo:demo@localhost/demo';
process.env.SUPABASE_JWT_SECRET = 'super-secret-jwt-key-for-demo-mode-12345678';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.DEMO_MODE = 'true';

console.log('🚀 YAZOON Demo Mode (pg-mem) startet …');

// 2) قاعدة في الذاكرة + gen_random_uuid غير نقيّة (وإلا يتكرر نفس الـ UUID).
const db = newDb();
db.public.registerFunction({
  name: 'gen_random_uuid',
  returns: 'uuid',
  impure: true,
  implementation: () => crypto.randomUUID(),
});

// 3) حقن pool داخل db.js.
const MockPool = db.adapters.createPg().Pool;
const pool = new MockPool();
const { setPool } = await import('../src/config/db.js');
setPool(pool);

// 4) تطبيق كل الـ migrations بالترتيب الترقيمي (مع إزالة CREATE EXTENSION لـ pg-mem).
const migrationsDir = path.join(process.cwd(), 'migrations');
for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    .replace(/CREATE EXTENSION[^;]*;/gi, '');
  db.public.none(sql);
  console.log(`   ✓ Migration: ${file}`);
}

// 5) البذر: مستخدمان، 4 تصنيفات، 12 براداً، أغراض موزّعة، وحركات عيّنة.
const adminId = '11111111-1111-1111-1111-111111111111';
const staffId = '22222222-2222-2222-2222-222222222222';

const cats = {
  brot: crypto.randomUUID(),
  kaese: crypto.randomUUID(),
  belag: crypto.randomUUID(),
  saucen: crypto.randomUUID(),
};

// 12 براداً بترتيب ثابت.
const fridges = Array.from({ length: 12 }, (_, i) => ({
  id: crypto.randomUUID(),
  name: `Kühlschrank ${i + 1}`,
  position: i + 1,
}));
const K = (n) => fridges[n - 1].id;

// الأغراض: [name, unit, stock, min, catId, locationId|null, isOrdered]
// نفس المادة في برادين = صفّان مستقلان (لكلٍّ رصيده وحدّه) — Gouda في K1 و K7.
const items = [
  // Brot & Gebäck — على الرفّ (بلا براد)
  ['Kaisersemmel', 'Stück', 48, 20, cats.brot, null, false],
  ['Kornspitz', 'Stück', 12, 20, cats.brot, null, false],
  ['Mohnflesserl', 'Stück', 18, 10, cats.brot, null, false],
  ['Brezel', 'Stück', 6, 15, cats.brot, null, true],
  // Käse
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

// حركات عيّنة (السجل الثابت [INV-3]) — لترى Verlauf ممتلئاً فوراً: جاي/رايح/فاسد/تصحيح.
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

console.log('✅ Seed fertig — 2 Benutzer, 4 Kategorien, 12 Kühlschränke, 17 Artikel, 6 Bewegungen');
console.log('   Login: admin@demo.com / staff@demo.com — Passwort: demo');

// 6) تشغيل الخادم.
await import('../src/server.js');
