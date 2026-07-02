-- =============================================================================
-- 004_seed_sample_inventory.sql
-- الطبقة: migration — بيانات مخزون عيّنية لإظهار كل شاشات التطبيق.
-- السبب: بدون أصناف وحركات تبدو لوحة التحكم والبرادات والتنبيهات والسجل فارغة.
-- يراعي:
--   [INV-1] لا أرصدة سالبة.
--   [INV-4] كل الكميات numeric.
--   [INV-5] كل التواريخ timestamptz عبر now().
--   [INV-6] وحدة أساسية واحدة لكل عنصر.
-- آمن للتكرار: كل عنصر يُضاف فقط إذا لم يوجد اسمه سابقاً.
-- =============================================================================

WITH seed_items AS (
  SELECT *
  FROM (
    VALUES
      ('Semmel', 'Stück', 18, 25, 'Brot & Gebäck', NULL, false),
      ('Kornspitz', 'Stück', 42, 20, 'Brot & Gebäck', NULL, false),
      ('Brezel', 'Stück', 8, 12, 'Brot & Gebäck', NULL, true),
      ('Gouda', 'kg', 2.4, 3, 'Käse', 'Kühlschrank 01', false),
      ('Emmentaler', 'kg', 7, 3, 'Käse', 'Kühlschrank 02', false),
      ('Bergkäse', 'kg', 4.5, 3, 'Käse', 'Kühlschrank 02', false),
      ('Frischkäse', 'Packung', 5, 6, 'Milchprodukte', 'Kühlschrank 03', true),
      ('Schinken', 'kg', 1.2, 2, 'Belag & Zutaten', 'Kühlschrank 04', false),
      ('Truthahnschinken', 'kg', 5.5, 2, 'Belag & Zutaten', 'Kühlschrank 04', false),
      ('Butter', 'kg', 3.2, 3, 'Milchprodukte', 'Kühlschrank 05', false),
      ('Tomaten', 'kg', 6, 4, 'Obst & Gemüse', 'Kühlschrank 06', false),
      ('Gurkerl', 'Glas', 10, 4, 'Belag & Zutaten', 'Kühlschrank 07', false),
      ('Eier', 'Stück', 22, 30, 'Belag & Zutaten', 'Kühlschrank 08', false),
      ('Mayonnaise', 'Packung', 3, 5, 'Saucen & Aufstriche', 'Kühlschrank 09', true),
      ('Senf', 'Glas', 7, 4, 'Saucen & Aufstriche', 'Kühlschrank 09', false),
      ('Liptauer', 'kg', 1.5, 2, 'Saucen & Aufstriche', 'Kühlschrank 10', false),
      ('Milch', 'L', 9, 8, 'Milchprodukte', 'Kühlschrank 11', false),
      ('Orangensaft', 'L', 15, 6, 'Getränke', 'Kühlschrank 12', false),
      ('Servietten', 'Packung', 20, 10, 'Verpackung', NULL, false)
  ) AS s(name, unit, current_stock, min_stock_level, category_name, location_name, is_ordered)
)
INSERT INTO items
  (name, unit, current_stock, min_stock_level, category_id, location_id, is_ordered, last_ordered_at)
SELECT
  s.name,
  s.unit,
  s.current_stock::numeric,
  s.min_stock_level::numeric,
  c.id,
  l.id,
  s.is_ordered,
  CASE WHEN s.is_ordered THEN now() ELSE NULL END
FROM seed_items s
LEFT JOIN categories c ON lower(c.name) = lower(s.category_name)
LEFT JOIN locations l ON lower(l.name) = lower(s.location_name)
WHERE NOT EXISTS (
  SELECT 1 FROM items i WHERE lower(i.name) = lower(s.name)
);

-- حركات عيّنية للسجل: تُضاف فقط إذا كان هناك مستخدم admin موجود.
-- نستخدم أول admin متاح حتى لا نثبت UUID بيئة واحدة داخل migration.
WITH admin_user AS (
  SELECT id
  FROM users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1
),
seed_transactions AS (
  SELECT *
  FROM (
    VALUES
      ('Semmel', 'in', 60, 'Lieferung Morgen'),
      ('Semmel', 'out', -37, 'Frühstücksverkauf'),
      ('Semmel', 'waste', -5, 'Altware Ende des Tages'),
      ('Gouda', 'in', 5, 'Käselieferung'),
      ('Gouda', 'out', -2, 'Sandwich-Vorbereitung'),
      ('Gouda', 'waste', -0.6, 'Anschnitt verdorben'),
      ('Butter', 'in', 5, 'Wareneingang'),
      ('Butter', 'out', -1.8, 'Produktion'),
      ('Eier', 'in', 30, 'Lieferung'),
      ('Eier', 'out', -8, 'Backstube'),
      ('Mayonnaise', 'in', 8, 'Wareneingang'),
      ('Mayonnaise', 'out', -5, 'Sandwich-Station'),
      ('Liptauer', 'in', 3, 'Frische Lieferung'),
      ('Liptauer', 'waste', -1.5, 'Ablaufdatum erreicht'),
      ('Orangensaft', 'in', 18, 'Getränkelieferung'),
      ('Orangensaft', 'out', -3, 'Verkauf')
  ) AS s(item_name, type, quantity_change, note)
)
INSERT INTO transactions (item_id, user_id, type, quantity_change, note)
SELECT i.id, u.id, s.type, s.quantity_change::numeric, s.note
FROM seed_transactions s
JOIN items i ON lower(i.name) = lower(s.item_name)
CROSS JOIN admin_user u
WHERE NOT EXISTS (
  SELECT 1
  FROM transactions t
  WHERE t.item_id = i.id
    AND t.note = s.note
    AND t.quantity_change = s.quantity_change::numeric
);
